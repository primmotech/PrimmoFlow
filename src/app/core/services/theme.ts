import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  // Initialize darkMode signal based on localStorage or default to 'dark'
  // This will be overridden by user profile preference once loaded
  darkMode = signal<boolean>(localStorage.getItem('theme') === 'dark' || !localStorage.getItem('theme'));
userColor = signal<string>(localStorage.getItem('user-color') || '#3b82f6');
  /**
   * Sets the theme preference, applies it, and persists it in localStorage.
   * @param theme 'light' or 'dark'
   * @returns The theme preference that was set.
   */
  setThemePreference(theme: 'light' | 'dark'): 'light' | 'dark' {
    const isDark = theme === 'dark';
    this.darkMode.set(isDark);
    localStorage.setItem('theme', theme); // Store in localStorage for immediate application
    this.applyTheme(isDark);
    return theme;
  }
setUserColor(color: string) {
    this.userColor.set(color);
    localStorage.setItem('user-color', color);
  }
  /**
   * Applies the theme class to the document body.
   * @param isDark True for dark theme, false for light theme.
   */
  applyTheme(isDark: boolean) {
    if (isDark) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }

  /**
   * Toggles the theme between light and dark mode.
   */
  toggleTheme() {
    const newTheme = this.darkMode() ? 'light' : 'dark';
    this.setThemePreference(newTheme);
  }

  /**
   * Initializes the theme based on a provided preference or localStorage.
   * Defaults to 'dark' if no preference is found.
   * @param initialPreference Optional. The theme preference from user profile.
   */
  initTheme(initialPreference?: 'light' | 'dark') {
    const storedTheme = localStorage.getItem('theme');
    const effectiveTheme = initialPreference || storedTheme || 'dark'; // User preference > localStorage > default dark
    this.setThemePreference(effectiveTheme as 'light' | 'dark');
  }
}