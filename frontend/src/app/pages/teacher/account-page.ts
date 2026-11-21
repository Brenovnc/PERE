import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { errorMessage } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { TeacherProfile } from '../../core/teacher.models';
import { TeacherService } from '../../core/teacher.service';
import { PageHeader } from '../../shared/page-header';

@Component({
  selector: 'app-account-page',
  imports: [PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './account-page.html',
  styleUrl: './account-page.css',
})
export class AccountPage {
  protected readonly auth = inject(AuthService);
  private readonly teacher = inject(TeacherService);

  protected readonly profile = signal<TeacherProfile | null>(null);
  protected readonly editing = signal(false);
  protected readonly busy = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal('');

  protected readonly displayName = computed(
    () => this.profile()?.name || this.auth.user()?.name || 'Professor',
  );
  protected readonly initial = computed(() =>
    this.displayName().trim().charAt(0).toLocaleUpperCase('pt-BR'),
  );

  constructor() {
    this.teacher
      .getProfile()
      .then((profile) => this.profile.set(profile))
      .catch((e: unknown) => this.error.set(errorMessage(e)));
  }

  protected startEditing(): void {
    this.editing.set(true);
    this.error.set('');
    this.message.set('');
  }

  protected async save(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const data = new FormData(event.target as HTMLFormElement);
    const text = (name: string) => String(data.get(name) ?? '').trim();
    this.busy.set(true);
    this.error.set('');
    try {
      const profile = await this.teacher.updateProfile({
        name: text('name'),
        education: text('education') || null,
        institution: text('institution') || null,
      });
      this.profile.set(profile);
      // The header shows the name from the session; keep it in sync.
      this.auth.user.update((user) => (user ? { ...user, name: profile.name } : user));
      this.editing.set(false);
      this.message.set('Perfil atualizado.');
    } catch (e) {
      this.error.set(errorMessage(e, 'Não foi possível salvar o perfil.'));
    } finally {
      this.busy.set(false);
    }
  }

  protected async changePassword(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const data = new FormData(form);
    const currentPassword = String(data.get('currentPassword') ?? '');
    const newPassword = String(data.get('newPassword') ?? '');
    const confirmNewPassword = String(data.get('confirmNewPassword') ?? '');
    this.error.set('');
    if (newPassword.length < 8) {
      this.error.set('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      this.error.set('As senhas não coincidem.');
      return;
    }
    if (newPassword === currentPassword) {
      this.error.set('A nova senha deve ser diferente da atual.');
      return;
    }
    this.busy.set(true);
    try {
      await this.teacher.changePassword({ currentPassword, newPassword, confirmNewPassword });
      form.reset();
      this.message.set('Senha atualizada.');
    } catch (e) {
      this.error.set(errorMessage(e, 'Não foi possível atualizar a senha.'));
    } finally {
      this.busy.set(false);
    }
  }

  protected logout(): void {
    void this.auth.logout();
  }
}
