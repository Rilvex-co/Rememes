import { supabase } from './lib/supabase.ts';
import { getCurrentUser } from './lib/auth.ts';

export async function registerPushNotifications() {
  alert('Push setup started');

  if (!('Capacitor' in window) || !(window as any).Capacitor?.isPluginAvailable('PushNotifications')) {
    alert('PushNotifications plugin not available');
    return;
  }

  const { PushNotifications } = await import('@capacitor/push-notifications');

  alert('Requesting permissions...');
  const permission = await PushNotifications.requestPermissions();
  alert('Permission: ' + permission.receive);

  if (permission.receive !== 'granted') {
    alert('Permission denied');
    return;
  }

  await PushNotifications.register();
  alert('Registered for push');

  PushNotifications.addListener('registration', async (token) => {
    alert('Got token: ' + token.value);
    const user = await getCurrentUser();
    if (!user) {
      alert('User not logged in');
      return;
    }

    const { error } = await supabase.from('user_push_tokens').upsert({
      user_id: user.id,
      token: token.value,
      platform: 'android',
    });

    if (error) alert('Supabase insert error: ' + error.message);
    else alert('Token saved!');
  });
}
