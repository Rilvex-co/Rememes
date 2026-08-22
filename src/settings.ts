const themeOptions = document.querySelectorAll('.theme-option');

function setTheme(theme: string) {
  localStorage.setItem('rememes-theme', theme);
  document.body.classList.toggle('light', theme === 'light');
  themeOptions.forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-theme') === theme);
  });
}

// Load saved theme
const savedTheme = localStorage.getItem('rememes-theme') || 'dark';
setTheme(savedTheme);

themeOptions.forEach((btn) => {
  btn.addEventListener('click', () => {
    const theme = btn.getAttribute('data-theme') || 'dark';
    setTheme(theme);
  });
});
