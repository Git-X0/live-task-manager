import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  effect,
  inject,
  PLATFORM_ID,
  ViewChild,
  ElementRef,
  Inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  DragDropModule,
  CdkDragDrop,
  moveItemInArray,
} from '@angular/cdk/drag-drop';

interface Task {
  id: string;
  text: string;
  completed: boolean;
  category?: string;
  createdAt: string;
  deadline?: string;
}

@Component({
  selector: 'app-task-manager',
  imports: [CommonModule, DragDropModule],
  templateUrl: './task-manager.html',
  styleUrls: ['./task-manager.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'task-manager-root',
  },
})
export class TaskManager {
  // Signals for state management
  tasks = signal<Task[]>([]);
  filter = signal<'all' | 'active' | 'completed'>('all');
  newTask = signal('');
  editingId = signal<string | null>(null);
  editingText = signal('');
  theme = signal<'light' | 'dark'>('light');
  categories = signal<string[]>([]);
  newCategory = signal('');
  selectedCategory = signal<string | null>(null); // pro filtraci
  selectedTaskCategory = signal<string | null>(null); // pro nový úkol
  newTaskDeadline = signal<string>('');
  deadlineFilter = signal<'all' | 'with' | 'without' | 'soon'>('all');
  importError = signal<string | null>(null);
  toastMessage = signal<string | null>(null);
  toastType = signal<'success' | 'error' | null>(null);
  toastTimeout: ReturnType<typeof setTimeout> | null = null;

  @ViewChild('newTaskInput') newTaskInput!: ElementRef<HTMLInputElement>;
  @ViewChild('editInput') editInput!: ElementRef<HTMLInputElement>;

  readonly remainingCount = computed(
    () => this.tasks().filter((task) => !task.completed).length
  );
  readonly filteredTasks = computed(() => {
    const filter = this.filter();
    const cat = this.selectedCategory();
    const deadlineFilter = this.deadlineFilter();
    return this.tasks().filter(
      (task) =>
        (filter === 'all' ||
          (filter === 'completed' && task.completed) ||
          (filter === 'active' && !task.completed)) &&
        (!cat || task.category === cat) &&
        (deadlineFilter === 'all' ||
          (deadlineFilter === 'with' && !!task.deadline) ||
          (deadlineFilter === 'without' && !task.deadline) ||
          (deadlineFilter === 'soon' && this.isDeadlineSoon(task)))
    );
  });
  readonly progress = computed(() => {
    const total = this.tasks().length;
    const completed = total - this.remainingCount();
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  });

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    if (isPlatformBrowser(this.platformId)) {
      effect(() => {
        localStorage.setItem('tasks', JSON.stringify(this.tasks()));
      });
      const savedTasks = localStorage.getItem('tasks');
      if (savedTasks) this.tasks.set(JSON.parse(savedTasks));
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'dark' || savedTheme === 'light') {
        this.theme.set(savedTheme);
      }
      this.setBodyTheme(this.theme());
      effect(() => {
        localStorage.setItem('theme', this.theme());
        this.setBodyTheme(this.theme());
      });
    }
  }

  addTask(): void {
    const taskText = this.newTask().trim();
    const category = this.selectedTaskCategory();
    const deadline = this.newTaskDeadline().trim();
    if (taskText) {
      this.tasks.update((tasks) => [
        ...tasks,
        {
          id: Date.now().toString(),
          text: taskText,
          completed: false,
          ...(category ? { category } : {}),
          createdAt: new Date().toISOString(),
          ...(deadline ? { deadline } : {}),
        },
      ]);
      this.newTask.set('');
      this.selectedTaskCategory.set(null);
      this.newTaskDeadline.set('');
      setTimeout(() => {
        if (this.newTaskInput?.nativeElement) {
          this.newTaskInput.nativeElement.focus();
        }
      }, 0);
      this.showToast('Úkol přidán!', 'success');
    }
  }

  toggleTask(id: string): void {
    this.tasks.update((tasks) =>
      tasks.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
  }

  removeTask(id: string): void {
    this.tasks.update((tasks) => tasks.filter((task) => task.id !== id));
    this.showToast('Úkol smazán.', 'success');
  }

  startEdit(task: Task): void {
    this.editingId.set(task.id);
    this.editingText.set(task.text);
    setTimeout(() => {
      if (this.editInput) this.editInput.nativeElement.focus();
    }, 0);
  }

  saveEdit(id: string): void {
    const newText = this.editingText().trim();
    if (newText) {
      this.tasks.update((tasks) =>
        tasks.map((task) =>
          task.id === id ? { ...task, text: newText } : task
        )
      );
      this.showToast('Úkol upraven.', 'success');
    }
    this.editingId.set(null);
  }

  clearCompleted(): void {
    this.tasks.update((tasks) => tasks.filter((task) => !task.completed));
  }

  drop(event: CdkDragDrop<Task[]>): void {
    const current = this.filteredTasks();
    moveItemInArray(current, event.previousIndex, event.currentIndex);
    const ids = current.map((t) => t.id);
    this.tasks.update((tasks) => {
      const filtered = tasks.filter((t) => ids.includes(t.id));
      const rest = tasks.filter((t) => !ids.includes(t.id));
      return [...current, ...rest];
    });
  }

  toggleTheme(): void {
    this.theme.update((t) => (t === 'light' ? 'dark' : 'light'));
  }

  addCategory(): void {
    const cat = this.newCategory().trim();
    if (cat && !this.categories().includes(cat)) {
      this.categories.update((cats) => [...cats, cat]);
      this.newCategory.set('');
    }
  }

  isDeadlineOver(task: Task): boolean {
    if (!task.deadline || task.completed) return false;
    return new Date(task.deadline).getTime() < Date.now();
  }

  isDeadlineSoon(task: Task): boolean {
    if (!task.deadline || task.completed) return false;
    const now = Date.now();
    const deadline = new Date(task.deadline).getTime();
    return deadline > now && deadline - now <= 24 * 60 * 60 * 1000;
  }

  exportData(): void {
    const data = {
      tasks: this.tasks(),
      categories: this.categories(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'task-manager-export.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  importData(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (
          !data ||
          typeof data !== 'object' ||
          !Array.isArray(data.tasks) ||
          !Array.isArray(data.categories)
        ) {
          throw new Error('Neplatná struktura souboru.');
        }
        for (const t of data.tasks) {
          if (
            typeof t !== 'object' ||
            typeof t.id !== 'string' ||
            typeof t.text !== 'string' ||
            typeof t.completed !== 'boolean'
          ) {
            throw new Error('Neplatný úkol v souboru.');
          }
        }
        for (const c of data.categories) {
          if (typeof c !== 'string') {
            throw new Error('Neplatná kategorie v souboru.');
          }
        }
        this.tasks.set(data.tasks);
        this.categories.set(data.categories);
        this.importError.set(null);
      } catch (e) {
        this.importError.set((e as Error).message || 'Chyba při importu.');
      }
    };
    reader.readAsText(file);
    input.value = '';
  }

  showToast(message: string, type: 'success' | 'error' = 'success') {
    this.toastMessage.set(message);
    this.toastType.set(type);
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.toastMessage.set(null);
      this.toastType.set(null);
    }, 2500);
  }

  private setBodyTheme(theme: 'light' | 'dark') {
    if (typeof document !== 'undefined') {
      document.body.setAttribute('data-theme', theme);
    }
  }
}
