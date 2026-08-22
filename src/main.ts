import './styles/main.css';
import { supabase } from './lib/supabase.ts';
import { getCurrentUser } from './lib/auth.ts';

function showError(msg: string) {
  document.body.insertAdjacentHTML('beforeend', `<div style="position:fixed;bottom:0;left:0;right:0;background:#FF453A;color:#fff;padding:12px;z-index:9999;font-size:12px;white-space:pre-wrap;">${msg}</div>`);
}

window.addEventListener('error', (event) => {
  const stack = event.error?.stack || event.message || 'Unknown error';
  showError(stack);
});

window.addEventListener('unhandledrejection', (event) => {
  const stack = event.reason?.stack || event.reason?.message || 'Unhandled rejection';
  showError(stack);
});

function showToast(text: string) {
  const toast = document.createElement('div');
  toast.textContent = text;
  toast.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#111113;border-bottom:1px solid #2B2B30;color:#F5F5F7;padding:12px;z-index:99998;font-size:14px;box-shadow:0 4px 8px rgba(0,0,0,0.4);';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function formatNotification(n: any): string {
  const actor = n.actor?.username || 'Someone';
  switch (n.type) {
    case 'like': return `${actor} liked your post`;
    case 'comment': return `${actor} commented on your post`;
    case 'remix': return `${actor} remixed your post`;
    case 'battle_result': return `You won a battle! +${n.metadata?.xpReward || 20} XP`;
    case 'follow': return `${actor} started following you`;
    default: return `New notification`;
  }
}

async function updateUnreadBadge() {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;

  const user = await getCurrentUser();
  if (!user) return;

  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false);

  if (error) {
    console.error('Error fetching unread count:', error);
    return;
  }

  if (count && count > 0) {
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
}

async function initHeader(user: any) {
  const headerAvatar = document.getElementById('header-avatar');

  if (headerAvatar) {
    const username = user.user_metadata?.username || 'JD';
    const { data: profile } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .single();

    if (profile && profile.avatar_url) {
      headerAvatar.innerHTML = `<img src="${profile.avatar_url}" alt="avatar" />`;
    } else {
      headerAvatar.textContent = username.charAt(0).toUpperCase();
    }
  }
}

function showSwipeTransition(direction: 'left' | 'right', targetPage: string) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:99999;transition:transform 0.3s ease-out;';
  overlay.style.background = '#0A0A0B';
  overlay.style.transform = direction === 'left' ? 'translateX(100%)' : 'translateX(-100%)';
  document.body.appendChild(overlay);
  void overlay.offsetWidth;
  overlay.style.transform = 'translateX(0)';
  setTimeout(() => {
    window.location.href = targetPage;
  }, 250);
}

function initSwipeNavigation() {
  const tabPages = ['index.html', 'create.html', 'profile.html'];
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  if (!tabPages.includes(currentPage)) return;

  let startX = 0;
  let startY = 0;

  document.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    const touch = e.changedTouches[0];
    const endX = touch.clientX;
    const endY = touch.clientY;
    const deltaX = endX - startX;
    const deltaY = endY - startY;

    if (Math.abs(deltaX) > 80 && Math.abs(deltaX) > Math.abs(deltaY)) {
      const currentIndex = tabPages.indexOf(currentPage);
      if (deltaX < 0 && currentIndex < tabPages.length - 1) {
        showSwipeTransition('left', tabPages[currentIndex + 1]);
      } else if (deltaX > 0 && currentIndex > 0) {
        showSwipeTransition('right', tabPages[currentIndex - 1]);
      }
    }
  }, { passive: true });
}


(function() {
  const saved = localStorage.getItem('rememes-theme') || 'dark';
  document.body.classList.toggle('light', saved === 'light');
})();

async function initGlobal() {
  const user = await getCurrentUser();
  if (!user) return;

  await initHeader(user);
  initSwipeNavigation();

  supabase
    .channel(`notifications-${user.id}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload) => {
      showToast(formatNotification(payload.new));
      updateUnreadBadge();
    })
    .subscribe();

  updateUnreadBadge();
}

initGlobal();
console.log('REMEMES app loaded');
