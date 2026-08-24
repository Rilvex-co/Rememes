import { supabase } from './lib/supabase.ts';
import { getCurrentUser } from './lib/auth.ts';
import { generateShareCard } from './shareCard.ts';

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
    feedContainer.innerHTML = `
      <div class="empty-state" style="text-align:center; padding:60px 20px;">
        <div style="font-size:48px;">😂</div>
        <h3 style="font-size:1.2rem; margin:12px 0;">No memes yet</h3>
        <p style="color:#9E9EA3; margin-bottom:20px;">Be the first to create one!</p>
        <a href="create.html" style="background:#FFFFFF; color:#000; border:none; border-radius:10px; padding:10px 24px; font-weight:600; text-decoration:none;">Create Meme</a>
      </div>`;
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
        <div class="post-row">
          <div style="position:absolute; left:20px; top:45px; bottom:30px; width:2px; background:#4A4A55; border-radius:2px; z-index:1;">
            <svg viewBox="0 0 34 20" preserveAspectRatio="none" style="position:absolute; left:-1px; bottom:-12px; width:36px; height:20px; z-index:1;">
              <path d="M2 0 V10 Q2 18 10 18 H32" stroke="#4A4A55" stroke-width="2" fill="none" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="post-avatar">
            ${post.avatar_url ? `<img src="${post.avatar_url}" alt="${username}" />` : username.charAt(0).toUpperCase()}
          </div>
          <div class="post-main">
            <div class="post-header">
              <span class="post-author">${username}</span>
              <span class="post-meta">${timeAgo}</span>
            </div>
            <p class="post-caption">${escapeHtml(post.caption || '')}</p>
            <div class="post-media">
              ${post.type === 'image'
                ? `<img src="${post.media_url}" alt="meme" loading="lazy" />`
                : `<video src="${post.media_url}" controls preload="metadata"></video>`}
            </div>
            <div class="post-actions">
              <button class="action-button like-btn ${isLiked ? 'liked' : ''}" data-post-id="${post.id}" data-action="like">
                ${isLiked ? '❤️' : '🤍'} <span class="like-count">${likeCount}</span>
              </button>
              <button class="action-button comment-btn" data-post-id="${post.id}" data-action="comment">💬 <span class="comment-count">${commentCount}</span></button>
              <button class="action-button remix-btn" data-post-id="${post.id}" data-action="remix">🔁 <span class="remix-count">${remixCount}</span></button>
              <button class="action-button share-btn" data-post-id="${post.id}" data-action="share">↗️ Share</button>
            </div>
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

    const shareFile = await generateShareCard(post);
    const postUrl = `${window.location.origin}/post.html?id=${postId}`;
    const shareText = `${post.caption || 'Check this meme on Rememes'}\n${postUrl}`;

    if (navigator.canShare && navigator.canShare({ files: [shareFile] })) {
      await navigator.share({
        files: [shareFile],
        title: 'Rememes',
        text: shareText,
      });
    } else if (navigator.share) {
      await navigator.share({
        title: 'Rememes',
        text: shareText,
        url: postUrl,
      });
    } else {
      const url = URL.createObjectURL(shareFile);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rememes-share.png';
      a.click();
      URL.revokeObjectURL(url);
      alert('Share link copied: ' + postUrl);
    }
  } catch (error: any) {
    console.error('Share error:', error);
    alert('Could not generate share card: ' + (error?.message || 'Unknown error'));
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
