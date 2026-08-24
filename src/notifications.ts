import { supabase } from './lib/supabase.ts';
import { getCurrentUser } from './lib/auth.ts';

const container = document.getElementById('notifications-container') as HTMLElement | null;

if (!container) {
  console.error('notifications-container not found');
} else {
  loadNotifications();
}

async function loadNotifications() {
  container.innerHTML = '<div class="loading">Loading...</div>';
  const user = await getCurrentUser();
  if (!user) {
    container.innerHTML = '<p class="empty-state">Not logged in.</p>';
    return;
  }

  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('*, actor:profiles!notifications_actor_id_fkey(username)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Error fetching notifications:', error);
    container.innerHTML = `<p class="empty-state">Failed to load notifications: ${error.message}</p>`;
    return;
  }

  // Mark all as read
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false);

  if (!notifications || notifications.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="text-align:center; padding:60px 20px;">
        <div style="font-size:48px;">🔔</div>
        <h3 style="font-size:1.2rem; margin:12px 0;">No notifications</h3>
        <p style="color:#9E9EA3;">You're all caught up!</p>
      </div>`;
    return;
  }

  container.innerHTML = notifications.map((n: any) => {
    const actorName = n.actor?.username || 'Someone';
    const timeAgo = timeSince(new Date(n.created_at));
    const text = formatNotification(n, actorName);
    return `
      <div class="notification-item">
        <div class="notification-avatar">${actorName.charAt(0).toUpperCase()}</div>
        <div class="notification-body">
          <div class="notification-text">${text}</div>
          <div class="notification-time">${timeAgo}</div>
        </div>
      </div>
    `;
  }).join('');
}

function formatNotification(n: any, actorName: string): string {
  switch (n.type) {
    case 'like': return `${actorName} liked your post`;
    case 'comment': return `${actorName} commented on your post`;
    case 'remix': return `${actorName} remixed your post`;
    case 'battle_result': return `You won a battle! +${n.metadata?.xpReward || 20} XP`;
    case 'follow': return `${actorName} started following you`;
    default: return `New notification`;
  }
}

function timeSince(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  let interval = Math.floor(seconds / 31536000);
  if (interval >= 1) return interval + 'y';
  interval = Math.floor(seconds / 2592000);
  if (interval >= 1) return interval + 'mo';
  interval = Math.floor(seconds / 86400);
  if (interval >= 1) return interval + 'd';
  interval = Math.floor(seconds / 3600);
  if (interval >= 1) return interval + 'h';
  interval = Math.floor(seconds / 60);
  if (interval >= 1) return interval + 'm';
  return Math.floor(seconds) + 's';
}
