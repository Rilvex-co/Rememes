import { supabase } from './lib/supabase.ts';
import { getCurrentUser } from './lib/auth.ts';

const step1 = document.getElementById('step-1') as HTMLElement;
const step2 = document.getElementById('step-2') as HTMLElement;
const step3 = document.getElementById('step-3') as HTMLElement;
const suggestedUsers = document.getElementById('suggested-users') as HTMLElement;
const suggestedTopics = document.getElementById('suggested-topics') as HTMLElement;
const skipBtn = document.getElementById('skip-btn') as HTMLButtonElement;

let followedUsers: string[] = [];

function showStep(step: HTMLElement) {
  [step1, step2, step3].forEach(s => s.classList.remove('active'));
  step.classList.add('active');
}

document.getElementById('next-1')?.addEventListener('click', () => showStep(step2));
document.getElementById('next-2')?.addEventListener('click', () => showStep(step3));
document.getElementById('next-3')?.addEventListener('click', finishOnboarding);

skipBtn.addEventListener('click', finishOnboarding);

async function loadSuggestions() {
  const user = await getCurrentUser();
  if (!user) {
    finishOnboarding();
    return;
  }

  // Fetch some random users to follow (exclude self)
  const { data: users, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .neq('id', user.id)
    .limit(10);

  if (error) {
    console.error('Error loading suggestions:', error);
    return;
  }

  if (users && users.length > 0) {
    suggestedUsers.innerHTML = users.map((u: any) => `
      <div class="user-suggestion" data-user-id="${u.id}">
        <div class="avatar-circle">${u.avatar_url ? `<img src="${u.avatar_url}" alt="${u.username}" />` : (u.display_name || u.username).charAt(0).toUpperCase()}</div>
        <div class="user-info">
          <div class="user-name">${u.display_name || u.username}</div>
          <div class="user-sub">@${u.username}</div>
        </div>
        <button class="follow-btn" data-user-id="${u.id}">Follow</button>
      </div>
    `).join('');

    // Add click listeners for follow buttons
    suggestedUsers.querySelectorAll('.follow-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const targetId = (btn as HTMLElement).dataset.userId;
        if (!targetId) return;
        const isFollowing = btn.classList.contains('followed');
        if (!isFollowing) {
          await supabase.from('follows').insert({ follower_id: user.id, following_id: targetId });
          btn.classList.add('followed');
          btn.textContent = 'Following';
          followedUsers.push(targetId);
        } else {
          await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', targetId);
          btn.classList.remove('followed');
          btn.textContent = 'Follow';
          followedUsers = followedUsers.filter(id => id !== targetId);
        }
      });
    });
  }

  // Load topics (hashtags)
  const { data: hashtags } = await supabase
    .from('hashtags')
    .select('name, post_count')
    .order('post_count', { ascending: false })
    .limit(8);

  if (hashtags && hashtags.length > 0) {
    suggestedTopics.innerHTML = hashtags.map((h: any) => `
      <span class="topic-chip" style="display:inline-block; background:rgba(255,255,255,0.05); border:1px solid #2B2B30; border-radius:20px; padding:8px 16px; margin:4px; cursor:pointer;">#${h.name}</span>
    `).join('');
  } else {
    suggestedTopics.innerHTML = '<p style="color:#9E9EA3;">No topics yet. Create your own with #hashtag!</p>';
  }
}

function finishOnboarding() {
  localStorage.setItem('rememes-onboarding-seen', '1');
  window.location.href = 'index.html';
}

loadSuggestions();
