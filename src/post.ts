import { supabase } from './lib/supabase.ts';
import { getCurrentUser } from './lib/auth.ts';

const postContainer = document.getElementById('post-container') as HTMLElement | null;
const commentsContainer = document.getElementById('comments-container') as HTMLElement | null;
const commentForm = document.getElementById('comment-form') as HTMLFormElement | null;
const commentInput = document.getElementById('comment-input') as HTMLInputElement | null;

const urlParams = new URLSearchParams(window.location.search);
const postId = urlParams.get('id');

if (!postContainer || !commentsContainer || !commentForm || !commentInput) {
  console.error('One or more post page elements not found');
} else {
  if (!postId) {
    postContainer.innerHTML = '<p>Post not found.</p>';
  } else {
    loadPost(postId);
    loadComments(postId);
  }

  commentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!commentInput) return;
    const content = commentInput.value.trim();
    if (!content) return;

    const user = await getCurrentUser();
    if (!user) return;

    const { error } = await supabase.from('comments').insert({
      post_id: postId,
      user_id: user.id,
      content,
    });

    if (error) {
      console.error('Error adding comment:', error);
      alert('Failed to add comment.');
      return;
    }

    const { data: postData } = await supabase
      .from('posts')
      .select('user_id')
      .eq('id', postId)
      .single();

    if (postData && postData.user_id !== user.id) {
      await supabase.from('notifications').insert({
        user_id: postData.user_id,
        actor_id: user.id,
        type: 'comment',
        reference_id: postId,
      });
    }

    commentInput.value = '';
    loadComments(postId);
  });
}

async function loadPost(postId: string) {
  if (!postContainer) return;

  const { data: post, error } = await supabase
    .from('posts')
    .select('*')
    .eq('id', postId)
    .single();

  if (error || !post) {
    postContainer.innerHTML = '<p>Failed to load post.</p>';
    return;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', post.user_id)
    .single();

  const username = profile?.username || 'unknown';
  const timeAgo = timeSince(new Date(post.created_at));

  postContainer.innerHTML = `
    <article class="post-card">
      <div class="post-header">
        <div class="avatar">${username.charAt(0).toUpperCase()}</div>
        <div class="post-author-info">
          <span class="post-author">${username}</span>
          <span class="post-meta">${timeAgo}</span>
        </div>
      </div>
      <div class="post-media">
        ${post.type === 'image'
          ? `<img src="${post.media_url}" alt="meme" />`
          : `<video src="${post.media_url}" controls></video>`}
      </div>
      <div class="post-content">
        <p class="post-caption">${escapeHtml(post.caption || '')}</p>
      </div>
    </article>
  `;
}

async function loadComments(postId: string) {
  if (!commentsContainer) return;

  const { data: comments, error } = await supabase
    .from('comments')
    .select('*, profiles(username)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error loading comments:', error);
    commentsContainer.innerHTML = '<p>Failed to load comments.</p>';
    return;
  }

  if (!comments || comments.length === 0) {
    commentsContainer.innerHTML = '<p style="color:#9E9EA3;">No comments yet.</p>';
    return;
  }

  commentsContainer.innerHTML = comments.map((comment: any) => {
    const username = comment.profiles?.username || 'unknown';
    const timeAgo = timeSince(new Date(comment.created_at));
    return `
      <div class="comment-item">
        <div class="comment-avatar">${username.charAt(0).toUpperCase()}</div>
        <div class="comment-body">
          <div class="comment-username">${username}</div>
          <div class="comment-content">${escapeHtml(comment.content)}</div>
          <div class="comment-time">${timeAgo}</div>
        </div>
      </div>
    `;
  }).join('');
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
