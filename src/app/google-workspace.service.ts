import { Injectable, signal } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');

export interface Task {
  id: string;
  title: string;
  completed: boolean;
}

export interface ShoppingItem {
  id: string;
  name: string;
  checked: boolean;
}

export interface Meal {
  name: string;
  lunch: string;
  dinner: string;
}

export interface DayData {
  tasks: Task[];
  shoppingList: ShoppingItem[];
  mealPlan: Meal[];
}

@Injectable({ providedIn: 'root' })
export class GoogleWorkspaceService {
  isSigningIn = signal(false);
  loginError = signal<string | null>(null);
  cachedAccessToken = signal<string | null>(null);
  user = signal<User | null>(null);
  spreadsheetId = signal<string | null>(null);
  isLoading = signal(false);

  constructor() {
    onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        this.user.set(user);
        // We cannot reliably get the access token here, so if there's no cached token,
        // we might require the user to sign in again or wait until they sign in.
      } else {
        this.user.set(null);
        this.cachedAccessToken.set(null);
        this.spreadsheetId.set(null);
      }
    });
  }

  async login() {
    if (this.isSigningIn()) return;
    this.loginError.set(null);
    try {
      this.isSigningIn.set(true);
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        this.cachedAccessToken.set(credential.accessToken);
        this.user.set(result.user);
        await this.initializeSpreadsheet(credential.accessToken);
      }
    } catch (e: unknown) {
      console.error('Login failed', e);
      let errMsg = 'Gagal melakukan login.';
      const err = e as { code?: string; message?: string };
      if (err && (err.code === 'auth/cancelled-popup-request' || err.message?.includes('cancelled-popup-request'))) {
        errMsg = 'Proses login dibatalkan karena popup ditutup atau proses login lain sedang berjalan.';
      } else if (err && err.code === 'auth/popup-blocked') {
        errMsg = 'Popup login diblokir oleh browser Anda. Silakan izinkan popup untuk situs ini.';
      } else if (err && err.message) {
        errMsg = `Gagal masuk: ${err.message}`;
      }
      this.loginError.set(errMsg);
    } finally {
      this.isSigningIn.set(false);
    }
  }

  async logout() {
    await signOut(auth);
    this.cachedAccessToken.set(null);
    this.user.set(null);
    this.spreadsheetId.set(null);
  }

  private async initializeSpreadsheet(token: string) {
    this.isLoading.set(true);
    try {
      // Find spreadsheet
      const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=name%3D'Eluna%20Planner%20Daily%20Log'%20and%20mimeType%3D'application%2Fvnd.google-apps.spreadsheet'&fields=files(id,name)`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const driveData = await driveRes.json();
      
      let id = driveData.files?.[0]?.id;
      if (!id) {
        // Create it
        const createRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            properties: { title: 'Eluna Planner Daily Log' }
          })
        });
        const createData = await createRes.json();
        id = createData.spreadsheetId;
      }
      this.spreadsheetId.set(id);
    } catch (e) {
      console.error('Error initializing spreadsheet', e);
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadDate(dateString: string): Promise<DayData | null> {
    const token = this.cachedAccessToken();
    const sid = this.spreadsheetId();
    if (!token || !sid) return null;

    this.isLoading.set(true);
    try {
      // First construct sheet data
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sid}/values/${dateString}!A1:E?majorDimension=ROWS`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      
      if (data.error && data.error.code === 400) {
        // Sheet might not exist, return default empty
        return null;
      }

      const rows = data.values || [];
      const result: DayData = { tasks: [], shoppingList: [], mealPlan: [] };
      
      for (const row of rows) {
        const type = row[0];
        if (type === 'Task') {
          result.tasks.push({ id: row[1], title: row[2], completed: row[3] === 'TRUE' });
        } else if (type === 'Shopping') {
          result.shoppingList.push({ id: row[1], name: row[2], checked: row[3] === 'TRUE' });
        } else if (type === 'Meal') {
          result.mealPlan.push({ name: row[1], lunch: row[2], dinner: row[3] });
        }
      }
      return result;
    } catch (error) {
      console.error('Error loading date', error);
      return null;
    } finally {
      this.isLoading.set(false);
    }
  }

  async saveDate(dateString: string, data: DayData) {
    const token = this.cachedAccessToken();
    const sid = this.spreadsheetId();
    if (!token || !sid) return;

    this.isLoading.set(true);
    try {
      // Check if sheet exists
      const sheetInfoRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sid}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const sheetInfo = await sheetInfoRes.json();
      const sheetExists = sheetInfo.sheets?.some((s: { properties: { title: string } }) => s.properties.title === dateString);

      if (!sheetExists) {
        // Create sheet for new date
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sid}:batchUpdate`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [{
              addSheet: { properties: { title: dateString } }
            }]
          })
        });
      }

      // Format values
      const values: string[][] = [];
      data.tasks.forEach(t => values.push(['Task', t.id, t.title, t.completed ? 'TRUE' : 'FALSE', '']));
      data.shoppingList.forEach(s => values.push(['Shopping', s.id, s.name, s.checked ? 'TRUE' : 'FALSE', '']));
      data.mealPlan.forEach(m => values.push(['Meal', m.name || '', m.lunch || '', m.dinner || '', '']));
      
      // Update rows (clear and update)
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sid}/values/${dateString}!A1:E?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          range: `${dateString}!A1:E`,
          majorDimension: 'ROWS',
          values: values
        })
      });

    } catch (e) {
      console.error('Save failed', e);
    } finally {
      this.isLoading.set(false);
    }
  }
}
