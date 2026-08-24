import { supabase } from './lib/supabase.ts';
import { getCurrentUser, signOut } from './lib/auth.ts';

const profileContainer = document.getElementById('profile-container') as HTMLElement;
const logoutBtn = document.getElementById('logout-btn') as HTMLButtonElement;

logoutBtn.addEventListener('click', async () => {
  await signOut();
  window.location.href = 'login.html';
});

async function loadProfile() {
  const user = await getCurrentUser();
  if (!user) {
    profileContainer.innerHTML = '<p class="empty-state">Not logged in.</p>';
    return;
  }

  profileContainer.innerHTML = '<div class="loading">Loading...</div>';

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*, role')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error('Error fetching profile:', profileError);
    profileContainer.innerHTML = `<p class="empty-state">Failed to load profile: ${profileError.message}</p>`;
    return;
  }

  const { data: posts } = await supabase
    .from('posts')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const { data: streakData } = await supabase
    .from('user_streaks')
    .select('current_streak, icon, last_participation_date, badges, lost_streak, last_restore_date')
    .eq('user_id', user.id)
    .maybeSingle();

  const currentStreakRaw = streakData?.current_streak || 0;
  const streakIcon = streakData?.icon || '🔥';
  const lastParticipation = streakData?.last_participation_date;
  const isStreakActive = isStreakCurrentlyActive(lastParticipation);
  const currentStreak = isStreakActive ? currentStreakRaw : 0;
  const streakClass = isStreakActive ? '' : 'streak-inactive';
  const badges = streakData?.badges || [];

  const remixCount = profile.remix_count || 0;
  const role = profile.role || 'user';
  const xp = profile.xp || 0;
  const level = profile.level || 1;
  const battleWins = profile.battle_wins || 0;
  const displayName = profile.display_name || profile.username || 'unknown';
  const bio = profile.bio || '';
  const avatarUrl = profile.avatar_url || '';
  const avatarLetter = displayName.charAt(0).toUpperCase();

  const avatarHtml = avatarUrl
    ? `<img src="${avatarUrl}" alt="${displayName}" />`
    : avatarLetter;

  let postsGridHtml = '';
  if (posts && posts.length > 0) {
    postsGridHtml = posts.map((post: any) => {
      const media = post.type === 'image'
        ? `<img src="${post.media_url}" alt="post" loading="lazy" />`
        : `<video src="${post.media_url}" muted></video>`;
      return `<a href="post.html?id=${post.id}" class="grid-item" style="text-decoration:none; color:inherit;">${media}</a>`;
    }).join('');
  } else {
    postsGridHtml = '<p class="empty-state">No posts yet.</p>';
  }

  const badgesHtml = badges.length > 0
    ? `<div class="badges-row">${badges.map((badge: string) => `<span class="badge-chip">${badge}</span>`).join('')}</div>`
    : '';

  // Check if restore should be shown
  const lastRestore = streakData?.last_restore_date;
  const canRestore = !isStreakActive && streakData?.lost_streak > 0 && (!lastRestore || new Date(lastRestore) <= new Date(new Date().setDate(new Date().getDate() - 7)));

  const restoreButtonHtml = canRestore
    ? `<button id="restore-streak-btn" style="margin-top:12px; padding:8px 16px; background:#FFD60A; color:#000; border:none; border-radius:8px; font-weight:600; cursor:pointer;">Restore ${streakData?.lost_streak}-day Streak</button>`
    : '';

  profileContainer.innerHTML = `
    <div class="profile-header">
      <div class="profile-top">
        <div class="profile-avatar">${avatarHtml}</div>
        <div class="profile-info">
          <div class="profile-username">${displayName}</div>
          <div class="profile-bio">${formatBio(bio) || 'No bio yet'}</div>
        </div>
      </div>
      <div class="profile-meta">
        <div class="meta-item">
          <div class="meta-value">${xp}</div>
          <div class="meta-label">XP</div>
        </div>
        <div class="meta-item">
          <div class="meta-value">${level}</div>
          <div class="meta-label">Level</div>
        </div>
        <div class="meta-item">
          <div class="meta-value">${battleWins}</div>
          <div class="meta-label">Wins</div>
        </div>
        <div class="meta-item">
          <div class="meta-value ${streakClass}">${streakIcon} ${currentStreak}</div>
          <div class="meta-label">Streak</div>
        </div>
      </div>
      ${badgesHtml}
      ${restoreButtonHtml}
      ${role === 'admin' ? `<a href="admin.html" style="display:inline-block; margin-top:12px; padding:10px 20px; background:#FFD60A; color:#000; border-radius:10px; font-weight:600; text-decoration:none;">Admin Dashboard</a>` : ''}
    </div>

    <hr class="profile-divider" />
    <h3 class="title" style="font-size:1rem; font-weight:600;">Posts</h3>
    <hr class="profile-subdivider" />
    <div class="profile-grid">${postsGridHtml}</div>
  `;

  const restoreBtn = document.getElementById('restore-streak-btn');
  if (restoreBtn) {
    restoreBtn.addEventListener('click', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data: restored, error } = await supabase.rpc('restore_streak', { user_param: user.id, today });
      if (error) {
        console.error('Restore error:', error);
        alert('Failed to restore streak.');
        return;
      }
      if (restored === true) {
        alert('Streak restored!');
        loadProfile();
      } else {
        alert('Restore not available. You may need to wait 7 days or have no lost streak.');
      }
    });
  }
}

function isStreakCurrentlyActive(lastDate: string | null): boolean {
  if (!lastDate) return false;
  const today = new Date();
  today.setHours(0,0,0,0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const last = new Date(lastDate + 'T00:00:00');
  return last.getTime() >= yesterday.getTime();
}

function formatBio(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML.replace(/\n/g, '<br>');
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

loadProfile();
