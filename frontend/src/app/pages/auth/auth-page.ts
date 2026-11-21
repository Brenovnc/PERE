import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChildren,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { errorMessage } from '../../core/api-error';
import { AuthMode } from '../../core/auth.models';
import { AuthService } from '../../core/auth.service';
import { PereLogo } from '../../shared/pere-logo';
import { ThemeToggle } from '../../shared/theme-toggle';

interface Field {
  name: string;
  label: string;
  type?: string;
  autocomplete: string;
  maxLength: number;
  minLength?: number;
}

const nameField: Field = { name: 'name', label: 'Nome', autocomplete: 'name', maxLength: 120 };
const emailField: Field = {
  name: 'email',
  label: 'E-mail',
  type: 'email',
  autocomplete: 'email',
  maxLength: 320,
};
const loginEmailField: Field = { ...emailField, autocomplete: 'username' };
const loginPasswordField: Field = {
  name: 'password',
  label: 'Senha',
  type: 'password',
  autocomplete: 'current-password',
  maxLength: 128,
};
const newPasswordFields: Field[] = [
  {
    name: 'password',
    label: 'Senha',
    type: 'password',
    autocomplete: 'new-password',
    minLength: 8,
    maxLength: 128,
  },
  {
    name: 'confirmPassword',
    label: 'Confirmar senha',
    type: 'password',
    autocomplete: 'new-password',
    minLength: 8,
    maxLength: 128,
  },
];

const forms: Record<AuthMode, { title: string; fields: Field[] }> = {
  'teacher-login': {
    title: 'Entrar como professor',
    fields: [loginEmailField, loginPasswordField],
  },
  'teacher-register': {
    title: 'Criar conta de professor',
    fields: [nameField, emailField, ...newPasswordFields],
  },
  'student-login': { title: 'Entrar como aluno', fields: [loginEmailField, loginPasswordField] },
  'student-register': {
    title: 'Criar conta de aluno',
    fields: [nameField, emailField, ...newPasswordFields],
  },
};

const modes: { id: AuthMode; label: string }[] = [
  { id: 'teacher-login', label: 'Professor: entrar' },
  { id: 'teacher-register', label: 'Professor: cadastrar' },
  { id: 'student-login', label: 'Aluno: entrar' },
  { id: 'student-register', label: 'Aluno: cadastrar' },
];

@Component({
  selector: 'app-auth-page',
  imports: [PereLogo, ThemeToggle, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './auth-page.html',
})
export class AuthPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly tabs = viewChildren<ElementRef<HTMLButtonElement>>('tab');

  protected readonly modes = modes;
  protected readonly notice = this.auth.notice;
  protected readonly mode = signal<AuthMode>(
    inject(ActivatedRoute).snapshot.queryParamMap.get('modo') === 'aluno'
      ? 'student-login'
      : 'teacher-login',
  );
  protected readonly form = computed(() => forms[this.mode()]);
  protected readonly error = signal('');
  protected readonly submitting = signal(false);

  protected selectMode(mode: AuthMode): void {
    this.mode.set(mode);
    this.error.set('');
  }

  /** Arrow keys, Home and End move between tabs (WAI-ARIA tabs pattern). */
  protected onTabKeydown(event: KeyboardEvent, index: number): void {
    const last = modes.length - 1;
    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % modes.length
        : event.key === 'ArrowLeft'
          ? (index + last) % modes.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    this.selectMode(modes[next].id);
    this.tabs()[next]?.nativeElement.focus();
  }

  protected async submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const formElement = event.target as HTMLFormElement;
    const fields = Object.fromEntries(
      Array.from(new FormData(formElement).entries(), ([key, value]) => [key, String(value)]),
    );
    this.error.set('');
    this.submitting.set(true);
    try {
      const user = await this.auth.authenticate(this.mode(), fields);
      await this.router.navigateByUrl(this.auth.homeFor(user.role));
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.submitting.set(false);
    }
  }
}
