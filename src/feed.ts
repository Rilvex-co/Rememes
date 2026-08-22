import { supabase } from './lib/supabase.ts';
import { getCurrentUser } from './lib/auth.ts';

const feedContainer = document.getElementById('feed-container') as HTMLElement;

async function fetchPosts() {
  feedContainer.innerHTML = '<div class="loading">Loading...</div>';

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    feedContainer.innerHTML = '<p style="text-align:center; color:#9E9EA3;">Not logged in.</p>';
    return;
  }

  const { data: posts, error } = await supabase
    .rpc('get_feed_for_user', { user_param: currentUser.id });

  if (error) {
    console.error('Error fetching posts:', error);
    feedContainer.innerHTML = `<p style="text-align:center; color:#FF453A;">Failed to load feed: ${error.message}</p>`;
    return;
  }

  if (!posts || posts.length === 0) {
    feedContainer.innerHTML = '<p style="text-align:center; color:#9E9EA3;">No memes yet. Be the first to create one!</p>';
    return;
  }

  feedContainer.innerHTML = posts.map((post: any) => {
    const username = post.username || 'unknown';
    const timeAgo = timeSince(new Date(post.created_at));
    const likeCount = post.like_count || 0;
    const remixCount = post.remix_count || 0;
    const commentCount = post.comment_count || 0;
    const isLiked = post.liked_by_me || false;

    return `
      <article class="post-card" data-post-id="${post.id}">
        <div class="post-header">
          <a href="user.html?id=${post.user_id}" style="text-decoration:none; color:inherit; display:flex; align-items:center; gap:12px;">
            <div class="avatar">${post.avatar_url ? `<img src="${post.avatar_url}" alt="${username}" />` : username.charAt(0).toUpperCase()}</div>
            <div class="post-author-info">
              <span class="post-author">${username}</span>
              <span class="post-meta">${timeAgo}</span>
            </div>
          </a>
        </div>
        <div class="post-media">
          ${post.type === 'image'
            ? `<img src="${post.media_url}" alt="meme" loading="lazy" />`
            : `<video src="${post.media_url}" controls preload="metadata"></video>`}
        </div>
        <div class="post-content">
          <p class="post-caption">${escapeHtml(post.caption || '')}</p>
          <div class="post-actions">
            <button class="action-button like-btn ${isLiked ? 'liked' : ''}" data-post-id="${post.id}" data-action="like">
              ${isLiked ? '❤️' : '🤍'} <span class="like-count">${likeCount}</span>
            </button>
            <button class="action-button comment-btn" data-post-id="${post.id}" data-action="comment">💬 <span class="comment-count">${commentCount}</span></button>
            <button class="action-button remix-btn" data-post-id="${post.id}" data-action="remix">🔁 Remix <span class="remix-count">${remixCount}</span></button>
            <button class="action-button share-btn" data-post-id="${post.id}" data-action="share">↗️ Share</button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  feedContainer.addEventListener('click', handleActionClick);
}

async function handleActionClick(e: Event) {
  const target = e.target as HTMLElement;
  const button = target.closest('[data-action]') as HTMLElement;
  if (!button) return;

  const action = button.dataset.action;
  const postId = button.dataset.postId;
  if (!postId) return;

  if (action === 'like') {
    await toggleLike(postId, button);
  } else if (action === 'comment') {
    window.location.href = `post.html?id=${postId}`;
  } else if (action === 'remix') {
    window.location.href = `remix.html?id=${postId}`;
  } else if (action === 'share') {
    await sharePost(postId);
  }
}

async function toggleLike(postId: string, button: HTMLElement) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return;

  const isLiked = button.classList.contains('liked');
  const likeCountSpan = button.querySelector('.like-count');
  let currentCount = parseInt(likeCountSpan?.textContent || '0', 10);

  if (isLiked) {
    const { error } = await supabase
      .from('likes')
      .delete()
      .eq('user_id', currentUser.id)
      .eq('post_id', postId);

    if (error) return;

    const newCount = Math.max(0, currentCount - 1);
    button.classList.remove('liked');
    button.innerHTML = `🤍 <span class="like-count">${newCount}</span>`;
  } else {
    const { error } = await supabase
      .from('likes')
      .insert({ user_id: currentUser.id, post_id: postId });

    if (error) return;

    const { data: postData } = await supabase
      .from('posts')
      .select('user_id')
      .eq('id', postId)
      .single();

    if (postData && postData.user_id !== currentUser.id) {
      await supabase.from('notifications').insert({
        user_id: postData.user_id,
        actor_id: currentUser.id,
        type: 'like',
        reference_id: postId,
      });
    }

    const newCount = currentCount + 1;
    button.classList.add('liked');
    button.innerHTML = `❤️ <span class="like-count">${newCount}</span>`;
  }
}

async function sharePost(postId: string) {
  try {
    const { data: post } = await supabase
      .from('posts')
      .select('*')
      .eq('id', postId)
      .single();

    if (!post) return;

    const caption = post.caption || 'Check this meme on Rememes';
    const url = `${window.location.origin}/post.html?id=${postId}`;

    if (navigator.canShare && navigator.canShare({ files: [] }) && post.media_url) {
      const response = await fetch(post.media_url);
      const blob = await response.blob();
      const ext = blob.type.split('/')[1] || 'jpg';
      const file = new File([blob], `meme.${ext}`, { type: blob.type });
      await navigator.share({
        title: 'Rememes',
        text: caption,
        files: [file],
      });
    } else if (navigator.share) {
      await navigator.share({
        title: 'Rememes',
        text: caption,
        url,
      });
    } else {
      await navigator.clipboard.writeText(`${caption}\n${url}`);
      alert('Link copied!');
    }
  } catch (error) {
    console.error('Share error:', error);
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

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

fetchPosts();
