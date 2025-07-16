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
  standalone: true,
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

  // References to inputs
  @ViewChild('newTaskInput') newTaskInput!: ElementRef<HTMLInputElement>;
  @ViewChild('editInput') editInput!: ElementRef<HTMLInputElement>;

  // Derived state
  remainingCount = computed(
    () => this.tasks().filter((task) => !task.completed).length
  );
  filteredTasks = computed<Task[]>(() => {
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
  progress = computed(() => {
    const total = this.tasks().length;
    const completed = total - this.remainingCount();
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  });

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    // Effect for saving to localStorage (browser only)
    if (isPlatformBrowser(this.platformId)) {
      effect(() => {
        localStorage.setItem('tasks', JSON.stringify(this.tasks()));
      });
      // Load tasks from localStorage (browser only)
      const savedTasks = localStorage.getItem('tasks');
      if (savedTasks) this.tasks.set(JSON.parse(savedTasks));

      // Dark mode preference
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

  // Add new task
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
    }
  }

  // Toggle task completion
  toggleTask(id: string): void {
    this.tasks.update((tasks) =>
      tasks.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
  }

  // Remove task with animation
  removeTask(id: string): void {
    // Animace je řešena CSS třídou, ale v Angularu nemáme přímý přístup k elementu, pokud není přes ViewChild.
    // Pro jednoduchost odstraníme animaci, nebo ji ponecháme pouze pro browser.
    this.tasks.update((tasks) => tasks.filter((task) => task.id !== id));
  }

  // Start editing
  startEdit(task: Task): void {
    this.editingId.set(task.id);
    this.editingText.set(task.text);
    setTimeout(() => {
      if (this.editInput) this.editInput.nativeElement.focus();
    }, 0);
  }

  // Save edit
  saveEdit(id: string): void {
    const newText = this.editingText().trim();
    if (newText) {
      this.tasks.update((tasks) =>
        tasks.map((task) =>
          task.id === id ? { ...task, text: newText } : task
        )
      );
    }
    this.editingId.set(null);
  }

  // Clear all completed tasks
  clearCompleted(): void {
    this.tasks.update((tasks) => tasks.filter((task) => !task.completed));
  }

  drop(event: CdkDragDrop<Task[]>) {
    const current = this.filteredTasks();
    moveItemInArray(current, event.previousIndex, event.currentIndex);
    // Změna pořadí v původním poli podle filtrovaného pořadí
    const ids = current.map((t) => t.id);
    this.tasks.update((tasks) => {
      // zachováme úkoly, které nejsou ve filtru, a přidáme filtrované v novém pořadí
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
    return deadline > now && deadline - now <= 24 * 60 * 60 * 1000; // do 24h
  }

  private setBodyTheme(theme: 'light' | 'dark') {
    if (typeof document !== 'undefined') {
      document.body.setAttribute('data-theme', theme);
    }
  }
}
