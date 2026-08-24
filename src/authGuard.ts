import { supabase } from './lib/supabase.ts';
import { getCurrentUser } from './lib/auth.ts';
import { registerPushNotifications } from './pushNotifications.ts';

async function guard() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  // Register push for every authenticated user
  registerPushNotifications().catch(console.error);
}

guard();
