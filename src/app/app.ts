import { ChangeDetectionStrategy, Component, computed, signal, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { GoogleWorkspaceService, DayData, Task, ShoppingItem, Meal } from './google-workspace.service';

type Tab = 'today' | 'tasks' | 'shopping' | 'meals';

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  template: `
    <div class="max-w-md mx-auto h-screen bg-stone-50 flex flex-col relative shadow-2xl sm:border-x sm:border-stone-200 overflow-hidden text-stone-800 font-sans">
      
      <!-- Top Bar / Header -->
      <header class="pt-12 pb-4 px-6 bg-stone-50 z-10 sticky top-0 flex-shrink-0">
        <div class="mb-5 flex justify-between items-center">
          <span class="font-display font-bold text-rose-500 text-xl tracking-tight">Eluna<span class="text-rose-300">.</span></span>
          
          <div class="flex items-center gap-2">
            @if (ws.isLoading()) {
              <mat-icon class="animate-spin text-stone-400 scale-75">autorenew</mat-icon>
            }
            @if (ws.user()) {
              <button class="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-500 shrink-0 shadow-sm cursor-pointer border-none focus:outline-none focus:ring-2 focus:ring-rose-300" (click)="ws.logout()" title="Logout" type="button">
                <mat-icon class="scale-75">logout</mat-icon>
              </button>
            } @else {
              <!-- Google Sign In Button Minimal -->
              <button class="gsi-material-button scale-75 transform origin-right disabled:opacity-50" (click)="ws.login()" [disabled]="ws.isSigningIn()" type="button">
                <div class="gsi-material-button-state"></div>
                <div class="gsi-material-button-content-wrapper p-0">
                  <div class="gsi-material-button-icon m-0">
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" xmlns:xlink="http://www.w3.org/1999/xlink" style="display: block; width:24px;height:24px;">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                      <path fill="none" d="M0 0h48v48H0z"></path>
                    </svg>
                  </div>
                  <span class="gsi-material-button-contents" style="padding-right: 8px;">Login</span>
                </div>
              </button>
            }
          </div>
        </div>

        <div class="flex items-center justify-between mb-4 bg-white p-1 rounded-xl shadow-sm border border-stone-100">
          <button class="p-2 text-stone-400 hover:text-rose-500 transition-colors" (click)="prevDay()">
            <mat-icon>chevron_left</mat-icon>
          </button>
          <button type="button" class="relative flex items-center justify-center px-4 py-2 hover:bg-stone-50 rounded-xl transition-colors cursor-pointer group focus:outline-none" (click)="openDatePicker()">
            <div class="text-sm font-medium text-stone-700 font-display flex items-center gap-2 group-hover:text-rose-600 transition-colors">
              {{ displayDate() }}
              <mat-icon class="scale-75 text-stone-400 group-hover:text-rose-500">calendar_today</mat-icon>
            </div>
          </button>
          <button class="p-2 text-stone-400 hover:text-rose-500 transition-colors" (click)="nextDay()">
            <mat-icon>chevron_right</mat-icon>
          </button>
        </div>

        @if (activeTab() === 'today') {
           <h1 class="text-3xl font-display font-bold text-stone-900 mt-1">Halo ✨</h1>
        } @else if (activeTab() === 'tasks') {
          <h1 class="text-2xl font-display font-bold text-stone-900">Tugas</h1>
        } @else if (activeTab() === 'shopping') {
          <h1 class="text-2xl font-display font-bold text-stone-900">Daftar Belanja</h1>
        } @else if (activeTab() === 'meals') {
          <h1 class="text-2xl font-display font-bold text-stone-900">Menu Makan</h1>
        }
      </header>

      <!-- Main Content Area -->
      <main class="flex-1 overflow-y-auto px-6 pb-24 space-y-6" #scrollContainer>
        
        @if (!ws.cachedAccessToken()) {
           <div class="bg-rose-50 rounded-2xl p-6 border border-rose-100 flex flex-col items-center justify-center text-center mt-10">
             <mat-icon class="text-rose-300 scale-150 mb-4">auto_awesome</mat-icon>
             <h3 class="font-display font-bold text-rose-900 mb-2">Login untuk mulai</h3>
             <p class="text-rose-800/80 text-sm mb-4">Data kamu akan tersimpan di Google Sheet pribadi secara otomatis setiap harinya.</p>
             <button (click)="ws.login()" [disabled]="ws.isSigningIn()" class="px-6 py-2 bg-rose-500 text-white rounded-full font-medium text-sm shadow-md active:scale-95 transition-transform disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed">
               {{ ws.isSigningIn() ? 'Menghubungkan...' : 'Masuk dengan Google' }}
             </button>
             @if (ws.loginError()) {
               <div class="mt-4 p-3 bg-red-100 text-red-800 text-xs rounded-xl border border-red-200">
                 {{ ws.loginError() }}
               </div>
             }
           </div>
        } @else {
          <!-- TODAY VIEW -->
          @if (activeTab() === 'today') {
            <!-- Motivational Quote -->
            <div class="bg-rose-50 rounded-2xl p-4 border border-rose-100/50">
              <p class="text-rose-900/80 text-sm italic font-medium leading-relaxed">
                "Satu langkah kecil setiap hari, membuat semuanya jadi lebih mudah. Semangat untuk hari ini!"
              </p>
            </div>

            <!-- Quick Overview: Tasks -->
            <section>
              <div class="flex justify-between items-end mb-3">
                <h3 class="font-display font-semibold text-lg text-stone-800">Prioritas Hari Ini</h3>
                <button (click)="activeTab.set('tasks')" class="text-xs text-rose-500 font-medium pb-1">Lihat Semua</button>
              </div>
              <div class="space-y-3">
                @for (task of incompleteTasks().slice(0, 3); track task.id) {
                  <button type="button" class="w-full flex items-center text-left gap-3 p-3 bg-white rounded-xl shadow-sm border border-stone-100" (click)="toggleTask(task.id)">
                    <div class="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors"
                         [class.border-rose-400]="task.completed" [class.bg-rose-400]="task.completed" [class.border-stone-300]="!task.completed">
                      @if (task.completed) {
                        <mat-icon class="text-white scale-75">check</mat-icon>
                      }
                    </div>
                    <span class="text-stone-700 text-sm font-medium flex-1">{{ task.title }}</span>
                  </button>
                }
                @if (incompleteTasks().length === 0) {
                  <div class="text-center p-4 bg-white rounded-xl border border-stone-100 text-stone-400 text-sm">
                    Yay! Semua prioritas selesai atau belum ada tugas.
                  </div>
                }
              </div>
            </section>

            <!-- Quick Overview: Meal Plan -->
            <section>
              <h3 class="font-display font-semibold text-lg text-stone-800 mb-3">Menu Hari Ini</h3>
              @if (mealPlan().length > 0) {
                <div class="bg-white rounded-2xl p-4 shadow-sm border border-stone-100 flex items-center gap-4">
                  <div class="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center text-orange-400 shrink-0">
                    <mat-icon>restaurant</mat-icon>
                  </div>
                  <div>
                    <p class="text-xs text-stone-400 font-medium mb-0.5">Makan Malam (Contoh Pertama)</p>
                    <p class="text-stone-800 font-medium">{{ mealPlan()[0].dinner }}</p>
                  </div>
                </div>
              } @else {
                <div class="text-center p-4 bg-white rounded-xl border border-stone-100 text-stone-400 text-sm">
                  Belum ada menu untuk hari ini.
                </div>
              }
            </section>
          }

          <!-- TASKS VIEW -->
          @if (activeTab() === 'tasks') {
            <div class="flex gap-2">
              <input type="text" [(ngModel)]="newTaskTitle" placeholder="Tambah tugas baru..." 
                     (keyup.enter)="addTask()"
                     class="flex-1 bg-white rounded-xl border border-stone-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200 transition-shadow">
              <button (click)="addTask()" class="w-12 h-12 bg-rose-500 rounded-xl text-white flex items-center justify-center shadow-sm active:scale-95 transition-transform">
                <mat-icon>add</mat-icon>
              </button>
            </div>

            <div class="space-y-2 mt-4">
              @for (task of tasks(); track task.id) {
                <div class="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm border border-stone-100 transition-opacity" [class.opacity-50]="task.completed">
                  <button type="button" class="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                       (click)="toggleTask(task.id)"
                       [class.border-rose-400]="task.completed" [class.bg-rose-400]="task.completed" [class.border-stone-300]="!task.completed">
                    @if (task.completed) {
                      <mat-icon class="text-white scale-75">check</mat-icon>
                    }
                  </button>
                  <span class="text-stone-700 text-sm flex-1 transition-all" [class.line-through]="task.completed" [class.text-stone-400]="task.completed">{{ task.title }}</span>
                  <button (click)="deleteTask(task.id)" class="text-stone-300 p-1">
                    <mat-icon class="scale-90">close</mat-icon>
                  </button>
                </div>
              }
            </div>
          }

          <!-- SHOPPING VIEW -->
          @if (activeTab() === 'shopping') {
            <div class="flex gap-2">
              <input type="text" [(ngModel)]="newShoppingItem" placeholder="Tambah barang belanja..." 
                     (keyup.enter)="addShoppingItem()"
                     class="flex-1 bg-white rounded-xl border border-stone-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200 transition-shadow">
              <button (click)="addShoppingItem()" class="w-12 h-12 bg-stone-800 rounded-xl text-white flex items-center justify-center shadow-sm active:scale-95 transition-transform">
                <mat-icon>add</mat-icon>
              </button>
            </div>

            <div class="space-y-2 mt-4">
               @for (item of shoppingList(); track item.id) {
                <div class="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm border border-stone-100">
                  <button type="button" class="w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                       (click)="toggleShoppingItem(item.id)"
                       [class.border-stone-800]="item.checked" [class.bg-stone-800]="item.checked" [class.border-stone-300]="!item.checked">
                    @if (item.checked) {
                      <mat-icon class="text-white scale-75">check</mat-icon>
                    }
                  </button>
                  <span class="text-stone-700 text-sm flex-1 transition-all" [class.line-through]="item.checked" [class.text-stone-400]="item.checked">{{ item.name }}</span>
                  <button (click)="deleteShoppingItem(item.id)" class="text-stone-300 p-1">
                    <mat-icon class="scale-90">close</mat-icon>
                  </button>
                </div>
              }
            </div>
          }

          <!-- MEALS VIEW -->
          @if (activeTab() === 'meals') {
            <div class="flex gap-2 mb-4">
               <input type="text" [(ngModel)]="newMealLunch" placeholder="Makan Siang" class="flex-1 bg-white rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200">
               <input type="text" [(ngModel)]="newMealDinner" placeholder="Makan Malam" class="flex-1 bg-white rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200" (keyup.enter)="addMeal()">
               <button (click)="addMeal()" class="w-10 bg-orange-400 rounded-xl text-white flex items-center justify-center shadow-sm">
                 <mat-icon class="scale-75">add</mat-icon>
               </button>
            </div>
            
            <div class="space-y-4">
              @for (day of mealPlan(); track day.name) {
                <div class="bg-white rounded-xl p-4 shadow-sm border border-stone-100 flex justify-between items-center">
                  <div class="text-sm text-stone-600 space-y-1">
                    <p class="flex items-center gap-2 font-display text-stone-800 font-medium mb-1">{{ day.name }}</p>
                    <p class="flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-orange-300"></span> Siang: {{ day.lunch }}</p>
                    <p class="flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-rose-300"></span> Malam: {{ day.dinner }}</p>
                  </div>
                  <button (click)="deleteMeal(day.name)" class="text-stone-300 p-2">
                    <mat-icon class="scale-90">delete</mat-icon>
                  </button>
                </div>
              }
            </div>
          }
        }
      </main>

      <!-- Date Picker Overlay -->
      @if (showDatePicker()) {
        <div class="absolute inset-0 z-50 flex flex-col justify-end pointer-events-auto">
          <div class="absolute inset-0 bg-stone-900/30 backdrop-blur-sm transition-opacity" (click)="closeDatePicker()" role="button" tabindex="0" (keyup.enter)="closeDatePicker()"></div>
          
          <div class="bg-white rounded-t-3xl w-full p-6 shadow-2xl relative z-10 animate-slide-up flex flex-col">
            <div class="flex items-center justify-between mb-6 shrink-0">
              <button class="p-2 text-stone-400 hover:text-stone-700 transition-colors rounded-full hover:bg-stone-100" (click)="prevPickerMonth()">
                <mat-icon>chevron_left</mat-icon>
              </button>
              <h3 class="font-display font-semibold text-lg text-stone-800">{{ pickerMonthYear() }}</h3>
              <button class="p-2 text-stone-400 hover:text-stone-700 transition-colors rounded-full hover:bg-stone-100" (click)="nextPickerMonth()">
                <mat-icon>chevron_right</mat-icon>
              </button>
            </div>

            <div class="grid grid-cols-7 gap-1 mb-2 shrink-0">
              @for (day of ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']; track day) {
                <div class="text-xs font-semibold text-stone-400 text-center">{{ day }}</div>
              }
            </div>

            <div class="grid grid-cols-7 gap-1 shrink-0">
              @for (day of calendarGrid(); track day.date.toISOString()) {
                <button class="aspect-square flex flex-col items-center justify-center text-sm rounded-full transition-colors relative focus:outline-none"
                        [class.text-stone-300]="!day.isCurrentMonth"
                        [class.text-stone-700]="day.isCurrentMonth && !day.isSelected"
                        [class.bg-rose-500]="day.isSelected"
                        [class.text-white]="day.isSelected"
                        [class.hover:bg-rose-50]="!day.isSelected"
                        [class.font-semibold]="day.isSelected || day.isToday"
                        (click)="selectDate(day.date)">
                  <span>{{ day.date.getDate() }}</span>
                  @if (day.isToday && !day.isSelected) {
                    <span class="absolute bottom-1.5 w-1 h-1 bg-rose-500 rounded-full"></span>
                  }
                </button>
              }
            </div>
            
            <div class="mt-6 flex gap-3 shrink-0">
               <button class="flex-1 py-3 px-4 rounded-xl font-medium text-sm text-stone-600 bg-stone-100 hover:bg-stone-200 transition-colors" (click)="selectToday()">
                 Hari Ini
               </button>
               <button class="flex-1 py-3 px-4 rounded-xl font-medium text-sm text-white bg-rose-500 hover:bg-rose-600 shadow-md shadow-rose-200 transition-colors" (click)="closeDatePicker()">
                 Tutup
               </button>
            </div>
          </div>
        </div>
      }

      <!-- Bottom Navigation -->
      <nav class="absolute bottom-0 w-full bg-white border-t border-stone-100 px-6 py-3 pb-8 sm:pb-4 flex justify-between items-center shadow-[0_-4px_20px_rgba(0,0,0,0.03)] z-50">
        <button [class.text-rose-500]="activeTab() === 'today'" [class.text-stone-400]="activeTab() !== 'today'"
                (click)="switchTab('today')" class="flex flex-col items-center gap-1 transition-colors w-16">
          <mat-icon [class.fill-current]="activeTab() === 'today'">home</mat-icon>
          <span class="text-[10px] font-medium">Hari Ini</span>
        </button>
        <button [class.text-rose-500]="activeTab() === 'tasks'" [class.text-stone-400]="activeTab() !== 'tasks'"
                (click)="switchTab('tasks')" class="flex flex-col items-center gap-1 transition-colors w-16">
          <mat-icon>check_circle</mat-icon>
          <span class="text-[10px] font-medium">Tugas</span>
        </button>
        <button [class.text-rose-500]="activeTab() === 'shopping'" [class.text-stone-400]="activeTab() !== 'shopping'"
                (click)="switchTab('shopping')" class="flex flex-col items-center gap-1 transition-colors w-16">
          <mat-icon>shopping_cart</mat-icon>
          <span class="text-[10px] font-medium">Belanja</span>
        </button>
        <button [class.text-rose-500]="activeTab() === 'meals'" [class.text-stone-400]="activeTab() !== 'meals'"
                (click)="switchTab('meals')" class="flex flex-col items-center gap-1 transition-colors w-16">
          <mat-icon>restaurant_menu</mat-icon>
          <span class="text-[10px] font-medium">Menu</span>
        </button>
      </nav>

    </div>
  `
})
export class App {
  ws = inject(GoogleWorkspaceService);
  
  activeTab = signal<Tab>('today');
  
  currentDateObj = signal(new Date());
  
  displayDate = computed(() => {
    return new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(this.currentDateObj());
  });

  dateKey = computed(() => {
    const d = this.currentDateObj();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  showDatePicker = signal(false);
  pickerViewDate = signal(new Date());

  pickerMonthYear = computed(() => {
    return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(this.pickerViewDate());
  });

  calendarGrid = computed(() => {
    const viewDate = this.pickerViewDate();
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const startDate = new Date(firstDayOfMonth);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const endDate = new Date(lastDayOfMonth);
    if (endDate.getDay() !== 6) {
      endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
    }

    const grid: CalendarDay[] = [];
    const current = new Date(startDate);
    const today = new Date();
    const selected = this.currentDateObj();

    while (current <= endDate) {
      grid.push({
        date: new Date(current),
        isCurrentMonth: current.getMonth() === month,
        isToday: current.toDateString() === today.toDateString(),
        isSelected: current.toDateString() === selected.toDateString()
      });
      current.setDate(current.getDate() + 1);
    }

    return grid;
  });

  openDatePicker() {
    this.pickerViewDate.set(new Date(this.currentDateObj()));
    this.showDatePicker.set(true);
  }
  
  closeDatePicker() {
    this.showDatePicker.set(false);
  }

  prevPickerMonth() {
    const d = new Date(this.pickerViewDate());
    d.setMonth(d.getMonth() - 1);
    this.pickerViewDate.set(d);
  }

  nextPickerMonth() {
    const d = new Date(this.pickerViewDate());
    d.setMonth(d.getMonth() + 1);
    this.pickerViewDate.set(d);
  }

  selectDate(d: Date) {
    this.currentDateObj.set(new Date(d));
    this.showDatePicker.set(false);
  }
  
  selectToday() {
    this.currentDateObj.set(new Date());
    this.showDatePicker.set(false);
  }

  tasks = signal<Task[]>([]);
  newTaskTitle = '';
  incompleteTasks = computed(() => this.tasks().filter(t => !t.completed));

  shoppingList = signal<ShoppingItem[]>([]);
  newShoppingItem = '';
 
  mealPlan = signal<Meal[]>([]);
  newMealLunch = '';
  newMealDinner = '';
 
  private isSaving = false;
  private pendingSave = false;
  private autoSaveTimeout?: ReturnType<typeof setTimeout>;

  constructor() {
    // When date or spreadsheet ID changes, load data
    effect(() => {
      const dateStr = this.dateKey();
      const id = this.ws.spreadsheetId();
      if (id && dateStr) {
        this.loadDataForDate(dateStr);
      }
    });
  }

  async loadDataForDate(dateStr: string) {
    const data = await this.ws.loadDate(dateStr);
    if (data) {
      this.tasks.set(data.tasks);
      this.shoppingList.set(data.shoppingList);
      this.mealPlan.set(data.mealPlan);
    } else {
      // Setup Defaults for new day
      this.tasks.set([]);
      this.shoppingList.set([]);
      this.mealPlan.set([]);
    }
  }

  triggerSave() {
    if (this.autoSaveTimeout) clearTimeout(this.autoSaveTimeout);
    this.autoSaveTimeout = setTimeout(() => {
      this._saveCurrentData();
    }, 1500); // 1.5s debounce for saves
  }

  async _saveCurrentData() {
    if (!this.ws.spreadsheetId()) return;
    const dateStr = this.dateKey();
    const dataToSave: DayData = {
      tasks: [...this.tasks()],
      shoppingList: [...this.shoppingList()],
      mealPlan: [...this.mealPlan()]
    };
    await this.ws.saveDate(dateStr, dataToSave);
  }

  prevDay() {
    const d = new Date(this.currentDateObj());
    d.setDate(d.getDate() - 1);
    this.currentDateObj.set(d);
  }

  nextDay() {
    const d = new Date(this.currentDateObj());
    d.setDate(d.getDate() + 1);
    this.currentDateObj.set(d);
  }

  switchTab(tab: Tab) {
    this.activeTab.set(tab);
  }

  addTask() {
    if (!this.newTaskTitle.trim()) return;
    this.tasks.update(t => [{
      id: Math.random().toString(),
      title: this.newTaskTitle.trim(),
      completed: false
    }, ...t]);
    this.newTaskTitle = '';
    this.triggerSave();
  }

  toggleTask(id: string) {
    this.tasks.update(t => t.map(task => 
      task.id === id ? { ...task, completed: !task.completed } : task
    ));
    this.triggerSave();
  }

  deleteTask(id: string) {
    if (confirm('Hapus tugas ini?')) {
      this.tasks.update(t => t.filter(task => task.id !== id));
      this.triggerSave();
    }
  }

  addShoppingItem() {
    if (!this.newShoppingItem.trim()) return;
    this.shoppingList.update(s => [{
      id: Math.random().toString(),
      name: this.newShoppingItem.trim(),
      checked: false
    }, ...s]);
    this.newShoppingItem = '';
    this.triggerSave();
  }

  toggleShoppingItem(id: string) {
    this.shoppingList.update(s => s.map(item => 
      item.id === id ? { ...item, checked: !item.checked } : item
    ));
    this.triggerSave();
  }

  deleteShoppingItem(id: string) {
    if (confirm('Hapus belanjaan ini?')) {
      this.shoppingList.update(s => s.filter(item => item.id !== id));
      this.triggerSave();
    }
  }

  addMeal() {
    if (!this.newMealLunch.trim() && !this.newMealDinner.trim()) return;
    this.mealPlan.update((m: Meal[]) => [...m, {
      name: `Menu ${m.length + 1}`,
      lunch: this.newMealLunch.trim(),
      dinner: this.newMealDinner.trim()
    }]);
    this.newMealLunch = '';
    this.newMealDinner = '';
    this.triggerSave();
  }

  deleteMeal(name: string) {
    if (confirm('Hapus menu ini?')) {
      this.mealPlan.update(m => m.filter(meal => meal.name !== name));
      this.triggerSave();
    }
  }
}


