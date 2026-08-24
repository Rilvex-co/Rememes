import { supabase } from './lib/supabase.ts';
import { getCurrentUser } from './lib/auth.ts';

const container = document.getElementById('user-container') as HTMLElement | null;
const urlParams = new URLSearchParams(window.location.search);
const userId = urlParams.get('id');

if (!container || !userId) {
  if (container) container.innerHTML = '<p class="empty-state">User not found.</p>';
} else {
  loadUserProfile(userId);
}

async function loadUserProfile(userId: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    container.innerHTML = '<p class="empty-state">Not logged in.</p>';
    return;
  }

  container.innerHTML = '<div class="loading">Loading profile...</div>';

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !profile) {
    container.innerHTML = '<p class="empty-state">User not found.</p>';
    return;
  }

  const { data: streakData } = await supabase
    .from('user_streaks')
    .select('current_streak, icon, last_participation_date')
    .eq('user_id', userId)
    .maybeSingle();

  const currentStreakRaw = streakData?.current_streak || 0;
  const streakIcon = streakData?.icon || '🔥';
  const lastParticipation = streakData?.last_participation_date;
  const isStreakActive = isStreakCurrentlyActive(lastParticipation);
  const currentStreak = isStreakActive ? currentStreakRaw : 0;
  const streakClass = isStreakActive ? '' : 'streak-inactive';

  const { data: posts } = await supabase
    .from('posts')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  const username = profile.username || 'unknown';
  const displayName = profile.display_name || username;
  const bio = profile.bio || '';
  const xp = profile.xp || 0;
  const level = profile.level || 1;
  const battleWins = profile.battle_wins || 0;
  const avatarUrl = profile.avatar_url || '';
  const avatarLetter = displayName.charAt(0).toUpperCase();

  const avatarHtml = avatarUrl
    ? `<img src="${avatarUrl}" alt="${displayName}" />`
    : avatarLetter;

  let postsGrid = '';
  if (posts && posts.length > 0) {
    postsGrid = posts.map((post: any) => {
      const media = post.type === 'image'
        ? `<img src="${post.media_url}" alt="post" loading="lazy" />`
        : `<video src="${post.media_url}" muted></video>`;
      return `<a href="post.html?id=${post.id}" class="grid-item" style="text-decoration:none; color:inherit;">${media}</a>`;
    }).join('');
  } else {
    postsGrid = '<p class="empty-state">No posts yet.</p>';
  }

  container.innerHTML = `
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
    </div>

    <hr class="profile-divider" />
    <h3 style="font-size:1rem; font-weight:600;">Posts</h3>
    <hr class="profile-subdivider" />
    <div class="profile-grid">${postsGrid}</div>
  `;
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
