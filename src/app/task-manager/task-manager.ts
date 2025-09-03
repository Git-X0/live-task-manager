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
  OnInit,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  DragDropModule,
  CdkDragDrop,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import {
  ReactiveFormsModule,
  FormGroup,
  FormBuilder,
  Validators,
  ValidatorFn,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';

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
  imports: [CommonModule, DragDropModule, ReactiveFormsModule],
  templateUrl: './task-manager.html',
  styleUrls: ['./task-manager.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'task-manager-root',
  },
})
export class TaskManager implements OnInit {
  // Forms
  taskForm!: FormGroup;
  categoryForm!: FormGroup;

  // Signals for state management
  tasks = signal<Task[]>([]);
  filter = signal<'all' | 'active' | 'completed'>('all');
  editingId = signal<string | null>(null);
  editingText = signal('');
  theme = signal<'light' | 'dark'>('light');
  categories = signal<string[]>([]);
  selectedCategory = signal<string | null>(null); // for filtering
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

  private platformId = inject(PLATFORM_ID);
  private fb = inject(FormBuilder);

  constructor() {
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

  ngOnInit(): void {
    this.taskForm = this.fb.group({
      text: ['', [Validators.required, Validators.maxLength(100)]],
      category: [null],
      deadline: ['', [this.deadlineNotInPastValidator()]],
    });

    this.categoryForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(20)]],
    });
  }

  deadlineNotInPastValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null; // No deadline, valid
      }
      const deadlineTime = new Date(control.value).getTime();
      const now = Date.now();
      return deadlineTime < now ? { deadlineInPast: true } : null;
    };
  }

  addTask() {
    if (this.tasks().length >= 500) {
      this.showToast('Cannot add more than 500 tasks.', 'error');
      return;
    }

    this.taskForm.markAllAsTouched();
    if (this.taskForm.invalid) {
      const textErrors = this.taskForm.get('text')?.errors;
      if (textErrors?.['required']) {
        this.showToast('Task cannot be empty.', 'error');
      } else if (textErrors?.['maxlength']) {
        this.showToast('Task must have less than 100 characters.', 'error');
      }
      const deadlineErrors = this.taskForm.get('deadline')?.errors;
      if (deadlineErrors?.['deadlineInPast']) {
        this.showToast('Task deadline cannot be in the past.', 'error');
      }

      return;
    }

    const { text, category, deadline } = this.taskForm.value;

    this.tasks.update((tasks) => [
      ...tasks,
      {
        id: Date.now().toString(),
        text: text.trim(),
        completed: false,
        ...(category ? { category } : {}),
        createdAt: new Date().toISOString(),
        ...(deadline ? { deadline } : {}),
      },
    ]);

    this.taskForm.reset();
    // Close keyboard on mobile
    if (window.innerWidth < 700 && this.newTaskInput?.nativeElement) {
      this.newTaskInput.nativeElement.blur();
    }
    setTimeout(() => {
      if (this.newTaskInput?.nativeElement && window.innerWidth >= 700) {
        this.newTaskInput.nativeElement.focus();
      }
    }, 0);
    this.showToast('Task added!', 'success');
  }

  toggleTask(id: string) {
    this.tasks.update((tasks) =>
      tasks.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
  }

  removeTask(id: string) {
    this.tasks.update((tasks) => tasks.filter((task) => task.id !== id));
    this.showToast('Task deleted.', 'success');
  }

  startEdit(task: Task) {
    this.editingId.set(task.id);
    this.editingText.set(task.text);
    setTimeout(() => {
      if (this.editInput) this.editInput.nativeElement.focus();
    }, 0);
  }

  saveEdit(id: string) {
    const newText = this.editingText().trim();
    if (newText.length > 100) {
      this.showToast('Task must have less than 100 characters.', 'error');
      return;
    }
    if (newText) {
      this.tasks.update((tasks) =>
        tasks.map((task) =>
          task.id === id ? { ...task, text: newText } : task
        )
      );
      this.showToast('Task updated.', 'success');
    }
    this.editingId.set(null);
  }

  clearCompleted() {
    this.tasks.update((tasks) => tasks.filter((task) => !task.completed));
  }

  drop(event: CdkDragDrop<Task[]>) {
    const current = this.filteredTasks();
    moveItemInArray(current, event.previousIndex, event.currentIndex);
    const ids = current.map((t) => t.id);
    this.tasks.update((tasks) => {
      const filtered = tasks.filter((t) => ids.includes(t.id));
      const rest = tasks.filter((t) => !ids.includes(t.id));
      return [...current, ...rest];
    });
  }

  toggleTheme() {
    this.theme.update((t) => (t === 'light' ? 'dark' : 'light'));
  }

  addCategory() {
    if (this.categories().length >= 20) {
      this.showToast('Cannot add more than 20 categories.', 'error');
      return;
    }

    this.categoryForm.markAllAsTouched();
    if (this.categoryForm.invalid) {
      const errors = this.categoryForm.get('name')?.errors;
      if (errors?.['required']) {
        this.showToast('Category cannot be empty.', 'error');
      } else if (errors?.['maxlength']) {
        this.showToast('Category must have less than 20 characters.', 'error');
      }
      return;
    }

    const cat = this.categoryForm.value.name.trim();
    if (this.categories().includes(cat)) {
      this.showToast('Category already exists.', 'error');
      return;
    }

    this.categories.update((cats) => [...cats, cat]);
    this.categoryForm.reset();
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

  exportData() {
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

  importData(event: Event) {
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
          throw new Error('Invalid file structure.');
        }
        for (const t of data.tasks) {
          if (
            typeof t !== 'object' ||
            typeof t.id !== 'string' ||
            typeof t.text !== 'string' ||
            typeof t.completed !== 'boolean'
          ) {
            throw new Error('Invalid task in file.');
          }
        }
        for (const c of data.categories) {
          if (typeof c !== 'string') {
            throw new Error('Invalid category in file.');
          }
        }
        this.tasks.set(data.tasks);
        this.categories.set(data.categories);
        this.importError.set(null);
      } catch (e) {
        this.importError.set((e as Error).message || 'Import error.');
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
