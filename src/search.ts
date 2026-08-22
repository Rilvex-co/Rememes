import { supabase } from './lib/supabase.ts';

const input = document.getElementById('search-input') as HTMLInputElement;
const resultsContainer = document.getElementById('results-container') as HTMLElement;

let debounceTimer: ReturnType<typeof setTimeout>;

input.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    performSearch(input.value.trim());
  }, 250);
});

async function performSearch(query: string) {
  if (!query) {
    resultsContainer.innerHTML = '<p class="empty-state">Start typing to search</p>';
    return;
  }

  resultsContainer.innerHTML = '<p class="empty-state">Searching...</p>';

  // Search users by username prefix
  const { data: users, error: userError } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .ilike('username', `${query}%`)
    .limit(20);

  if (userError) console.error('User search error:', userError);

  // Search posts by caption prefix
  const { data: posts, error: postError } = await supabase
    .from('posts')
    .select('id, caption, media_url, type, user_id, username:profiles(username)')
    .ilike('caption', `${query}%`)
    .eq('status', 'published')
    .limit(20);

  if (postError) console.error('Post search error:', postError);

  const usersHtml = users && users.length > 0
    ? users.map((u: any) => `
        <a href="user.html?id=${u.id}">
          <div class="user-result">
            <div class="user-avatar">${u.avatar_url ? `<img src="${u.avatar_url}" alt="${u.username}" />` : (u.display_name || u.username).charAt(0).toUpperCase()}</div>
            <div class="user-info">
              <span class="user-name">${u.display_name || u.username}</span>
              <span style="font-size:0.7rem;color:#9E9EA3;">@${u.username}</span>
            </div>
          </div>
        </a>
      `).join('')
    : '<p class="empty-state">No users found</p>';

  const postsHtml = posts && posts.length > 0
    ? posts.map((p: any) => `
        <a href="post.html?id=${p.id}">
          <div class="post-result">
            <div class="post-thumb">
              ${p.type === 'image' ? `<img src="${p.media_url}" alt="" />` : `<video src="${p.media_url}" muted></video>`}
            </div>
            <div class="post-caption">${escapeHtml(p.caption || '')}</div>
            <span style="font-size:0.7rem;color:#9E9EA3;">${p.username || ''}</span>
          </div>
        </a>
      `).join('')
    : '<p class="empty-state">No posts found</p>';

  resultsContainer.innerHTML = `
    <div class="result-section">
      <div class="section-title">Users</div>
      ${usersHtml}
    </div>
    <div class="result-section">
      <div class="section-title">Memes</div>
      ${postsHtml}
    </div>
  `;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
