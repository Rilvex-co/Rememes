import { signUp } from './lib/auth.ts';

const form = document.getElementById('signup-form') as HTMLFormElement;
const errorEl = document.getElementById('error-message') as HTMLDivElement;

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.style.display = 'none';
  const email = (document.getElementById('email') as HTMLInputElement).value;
  const password = (document.getElementById('password') as HTMLInputElement).value;
  const username = (document.getElementById('username') as HTMLInputElement).value;
  try {
    await signUp(email, password, username);
    window.location.href = 'login.html?signup=success';
  } catch (error: any) {
    errorEl.textContent = error.message || 'Signup failed';
    errorEl.style.display = 'block';
  }
});
