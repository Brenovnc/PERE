import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { PereLogo } from '../shared/pere-logo';
import { ThemeToggle } from '../shared/theme-toggle';

const links = [
  { label: 'Página inicial', path: '/teacher/home' },
  { label: 'Dashboard', path: '/teacher/dashboard' },
  { label: 'Módulos', path: '/teacher/modules' },
  { label: 'Turmas', path: '/teacher/classrooms' },
  { label: 'Comunidade', path: '/teacher/community' },
];

/** Teacher area shell: sticky header with navigation, theme toggle and the profile menu. */
@Component({
  selector: 'app-teacher-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, PereLogo, ThemeToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './teacher-layout.html',
  host: {
    '(document:pointerdown)': 'closeMenuOnOutsideClick($event)',
    '(document:keydown.escape)': 'closeMenuWithEscape()',
  },
})
export class TeacherLayout {
  private readonly auth = inject(AuthService);
  private readonly userMenu = viewChild.required<ElementRef<HTMLElement>>('userMenu');
  private readonly menuTrigger = viewChild.required<ElementRef<HTMLButtonElement>>('menuTrigger');

  protected readonly links = links;
  protected readonly menuOpen = signal(false);
  protected readonly displayName = computed(() => this.auth.user()?.name || 'Professor');
  protected readonly initial = computed(() =>
    this.displayName().trim().charAt(0).toLocaleUpperCase('pt-BR'),
  );

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenuOnOutsideClick(event: PointerEvent): void {
    if (this.menuOpen() && !this.userMenu().nativeElement.contains(event.target as Node))
      this.menuOpen.set(false);
  }

  protected closeMenuWithEscape(): void {
    if (!this.menuOpen()) return;
    this.menuOpen.set(false);
    this.menuTrigger().nativeElement.focus();
  }

  protected logout(): void {
    this.menuOpen.set(false);
    void this.auth.logout();
  }
}
