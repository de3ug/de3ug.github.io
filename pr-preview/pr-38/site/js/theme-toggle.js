const root = document.documentElement;
const toggleButton = document.querySelector('[data-theme-toggle]');

const applyTheme = (theme) => {
  root.dataset.theme = theme;
  if (toggleButton) {
    toggleButton.textContent = theme === 'dark' ? '☀️ Light' : '🌙 Dark';
    toggleButton.setAttribute('aria-pressed', theme === 'dark');
  }
};

const storedTheme = localStorage.getItem('theme');
applyTheme(storedTheme === 'dark' ? 'dark' : 'light');

if (toggleButton) {
  toggleButton.addEventListener('click', () => {
    const nextTheme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
  });
}

