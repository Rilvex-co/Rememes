import { signIn } from './lib/auth.ts';

const form = document.getElementById('login-form') as HTMLFormElement;
const errorEl = document.getElementById('error-message') as HTMLDivElement;

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.style.display = 'none';
  const email = (document.getElementById('email') as HTMLInputElement).value;
  const password = (document.getElementById('password') as HTMLInputElement).value;
  try {
    await signIn(email, password);
    window.location.href = 'index.html';
  } catch (error: any) {
    errorEl.textContent = error.message || 'Login failed';
    errorEl.style.display = 'block';
  }
});
