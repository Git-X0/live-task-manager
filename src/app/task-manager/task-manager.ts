import {
  Component,
  OnInit,
  signal,
  computed,
  effect,
  viewChild,
  ElementRef,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule, isPlatformBrowser } from '@angular/common';

interface Task {
  id: string;
  text: string;
  completed: boolean;
}

@Component({
  selector: 'app-task-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './task-manager.html',
  styleUrls: ['./task-manager.css'],
})
export class TaskManager implements OnInit {
  // Signály pro správu stavu
  tasks = signal<Task[]>([]);
  filter = signal<'all' | 'active' | 'completed'>('all');
  newTask = '';
  editingId = signal<string | null>(null);
  editingText = '';

  // Reference na inputy
  newTaskInput = viewChild<ElementRef>('newTaskInput');
  editInput = viewChild<ElementRef>('editInput');

  // Počet nekompletních úkolů
  remainingCount = computed(
    () => this.tasks().filter((task) => !task.completed).length
  );

  // Filtrované úkoly
  filteredTasks = computed<Task[]>(() => {
    const filter = this.filter();
    return this.tasks().filter(
      (task) =>
        filter === 'all' ||
        (filter === 'completed' && task.completed) ||
        (filter === 'active' && !task.completed)
    );
  });

  // Progres dokončených úkolů
  progress = computed(() => {
    const total = this.tasks().length;
    const completed = total - this.remainingCount();
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  });

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    // Efekt pro ukládání do localStorage - pouze v prohlížeči
    if (isPlatformBrowser(this.platformId)) {
      effect(() => {
        localStorage.setItem('tasks', JSON.stringify(this.tasks()));
      });
    }
  }

  ngOnInit(): void {
    // Načtení úkolů z localStorage - pouze v prohlížeči
    if (isPlatformBrowser(this.platformId)) {
      const savedTasks = localStorage.getItem('tasks');
      if (savedTasks) {
        this.tasks.set(JSON.parse(savedTasks));
      }
    }
  }

  // Přidání nového úkolu
  addTask(): void {
    const taskText = this.newTask.trim();
    if (taskText) {
      this.tasks.update((tasks) => [
        ...tasks,
        {
          id: Date.now().toString(),
          text: taskText,
          completed: false,
        },
      ]);
      this.newTask = '';
      setTimeout(() => {
        const input = this.newTaskInput();
        if (input) input.nativeElement.focus();
      }, 0);
    }
  }

  // Přepnutí stavu úkolu
  toggleTask(id: string): void {
    this.tasks.update((tasks) =>
      tasks.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
  }

  // Odstranění úkolu s animací
  removeTask(id: string): void {
    const taskElement = document.querySelector(`[data-task-id="${id}"]`);
    if (taskElement) {
      taskElement.classList.add('deleting');
      setTimeout(() => {
        this.tasks.update((tasks) => tasks.filter((task) => task.id !== id));
      }, 500);
    } else {
      this.tasks.update((tasks) => tasks.filter((task) => task.id !== id));
    }
  }

  // Spuštění editace
  startEdit(task: Task): void {
    this.editingId.set(task.id);
    this.editingText = task.text;
    setTimeout(() => {
      const input = this.editInput();
      if (input) input.nativeElement.focus();
    }, 0);
  }

  // Uložení editace
  saveEdit(id: string): void {
    const newText = this.editingText.trim();
    if (newText) {
      this.tasks.update((tasks) =>
        tasks.map((task) =>
          task.id === id ? { ...task, text: newText } : task
        )
      );
    } else {
      this.removeTask(id);
    }
    this.editingId.set(null);
  }

  // Smazání všech splněných úkolů
  clearCompleted(): void {
    const completedTasks = this.tasks().filter((task) => task.completed);
    completedTasks.forEach((task) => this.removeTask(task.id));
  }
}
