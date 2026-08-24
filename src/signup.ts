import { supabase } from './lib/supabase.ts';
import { signUp } from './lib/auth.ts';
import { registerPushNotifications } from './pushNotifications.ts';

const step1 = document.getElementById('step-1') as HTMLElement;
const step2 = document.getElementById('step-2') as HTMLElement;
const step3 = document.getElementById('step-3') as HTMLElement;
const errorMessage = document.getElementById('error-message') as HTMLElement;

function showStep(step: HTMLElement) {
  [step1, step2, step3].forEach(s => s.classList.remove('active'));
  step.classList.add('active');
}

document.getElementById('next-1')?.addEventListener('click', () => {
  const username = (document.getElementById('username') as HTMLInputElement).value.trim();
  if (!username) {
    alert('Please enter a username');
    return;
  }
  showStep(step2);
});

document.getElementById('next-2')?.addEventListener('click', () => {
  const email = (document.getElementById('email') as HTMLInputElement).value.trim();
  if (!email || !email.includes('@')) {
    alert('Please enter a valid email');
    return;
  }
  showStep(step3);
});

document.getElementById('back-2')?.addEventListener('click', () => showStep(step1));
document.getElementById('back-3')?.addEventListener('click', () => showStep(step2));

document.getElementById('create-account')?.addEventListener('click', async () => {
  const username = (document.getElementById('username') as HTMLInputElement).value.trim();
  const email = (document.getElementById('email') as HTMLInputElement).value.trim();
  const password = (document.getElementById('password') as HTMLInputElement).value;
  const confirmPassword = (document.getElementById('confirm-password') as HTMLInputElement).value;

  if (!username || !email || !password) {
    errorMessage.textContent = 'Please fill all fields.';
    errorMessage.style.display = 'block';
    return;
  }
  if (password.length < 6) {
    errorMessage.textContent = 'Password must be at least 6 characters.';
    errorMessage.style.display = 'block';
    return;
  }
  if (password !== confirmPassword) {
    errorMessage.textContent = 'Passwords do not match.';
    errorMessage.style.display = 'block';
    return;
  }

  errorMessage.style.display = 'none';
  const createBtn = document.getElementById('create-account') as HTMLButtonElement;
  createBtn.disabled = true;
  createBtn.textContent = 'Creating...';

  try {
    await signUp(email, password, username);
    registerPushNotifications().catch(console.error);
    // Redirect to onboarding to follow people
    window.location.href = 'onboarding.html';
  } catch (error: any) {
    errorMessage.textContent = error.message || 'Signup failed.';
    errorMessage.style.display = 'block';
    createBtn.disabled = false;
    createBtn.textContent = 'Create Account';
  }
});
