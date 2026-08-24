import { supabase } from './lib/supabase.ts';
import { getCurrentUser } from './lib/auth.ts';

export async function registerPushNotifications() {
  if (!('Capacitor' in window) || !(window as any).Capacitor?.isPluginAvailable('PushNotifications')) {
    return;
  }

  const { PushNotifications } = await import('@capacitor/push-notifications');

  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') {
    return;
  }

  await PushNotifications.register();

  PushNotifications.addListener('registration', async (token) => {
    const user = await getCurrentUser();
    if (!user) return;

    await supabase.from('user_push_tokens').upsert({
      user_id: user.id,
      token: token.value,
      platform: 'android',
    });
  });

  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    // Handle foreground notification if needed later
  });

  PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
    const data = notification.notification.data;
    if (data && data.url) {
      window.location.href = data.url;
    }
  });
}
