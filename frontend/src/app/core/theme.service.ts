import { Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';
const storageKey = 'pere-theme';

/** Light/dark theme. index.html applies the saved theme before Angular starts; this service keeps it in sync. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(
    document.documentElement.dataset['theme'] === 'light' ? 'light' : 'dark',
  );

  constructor() {
    // Keeps several open tabs in the same theme.
    window.addEventListener('storage', (event) => {
      if (event.key === storageKey && (event.newValue === 'light' || event.newValue === 'dark'))
        this.apply(event.newValue);
    });
  }

  toggle(): void {
    const next: Theme = this.theme() === 'dark' ? 'light' : 'dark';
    this.apply(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      /* Storage unavailable: the theme still changes for this page view. */
    }
  }

  private apply(theme: Theme): void {
    document.documentElement.dataset['theme'] = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#111111' : '#F7F5F1');
    this.theme.set(theme);
  }
}
