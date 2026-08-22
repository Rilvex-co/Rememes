import { supabase } from './lib/supabase.ts';
import { getCurrentUser } from './lib/auth.ts';

const container = document.getElementById('editor-container') as HTMLElement | null;
const textInputContainer = document.getElementById('text-input-container') as HTMLElement;
const floatingTextInput = document.getElementById('floating-text-input') as HTMLInputElement;
const addTextBtn = document.getElementById('add-text-btn') as HTMLButtonElement;

const urlParams = new URLSearchParams(window.location.search);
const postId = urlParams.get('id');

let originalPost: any = null;
let selectedFilter = 'none';
let mediaElement: HTMLImageElement | HTMLVideoElement | null = null;
let mediaContainer: HTMLElement | null = null;
let texts: Array<{ text: string; x: number; y: number }> = []; // normalized 0-1
let pendingPosition: {x: number; y: number} | null = null;

if (!container || !postId) {
  if (container) container.innerHTML = '<p>Invalid remix request.</p>';
} else {
  init();
}

async function init() {
  const user = await getCurrentUser();
  if (!user) return;

  const { data: post, error } = await supabase
    .from('posts')
    .select('*')
    .eq('id', postId)
    .single();

  if (error || !post) {
    container.innerHTML = '<p>Post not found.</p>';
    return;
  }

  originalPost = post;
  renderEditor(post);
}

function renderEditor(post: any) {
  const isImage = post.type === 'image';
  container.innerHTML = `
    <div class="editor-media" id="editor-media">
      ${isImage
        ? `<img id="media-img" src="${post.media_url}" alt="remix" />`
        : `<video id="media-video" src="${post.media_url}" controls></video>`}
    </div>
    <div class="form-group">
      <label>Caption</label>
      <textarea id="caption-input" rows="3" placeholder="Add a caption...">${escapeHtml(post.caption || '')}</textarea>
    </div>
    <div class="form-group">
      <label>Filter</label>
      <div class="filter-buttons" id="filter-buttons">
        <button class="filter-btn active" data-filter="none">None</button>
        <button class="filter-btn" data-filter="grayscale(100%)">B&W</button>
        <button class="filter-btn" data-filter="sepia(100%)">Sepia</button>
        <button class="filter-btn" data-filter="brightness(1.3)">Bright</button>
        <button class="filter-btn" data-filter="contrast(1.5)">Contrast</button>
        <button class="filter-btn" data-filter="saturate(2)">Saturate</button>
      </div>
    </div>
    <button class="btn-primary" id="publish-remix">Publish Remix</button>
  `;

  mediaContainer = document.getElementById('editor-media') as HTMLElement;
  mediaElement = isImage
    ? document.getElementById('media-img') as HTMLImageElement
    : document.getElementById('media-video') as HTMLVideoElement;

  const filterButtons = document.querySelectorAll('.filter-btn');
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedFilter = btn.dataset.filter || 'none';
      if (mediaElement) mediaElement.style.filter = selectedFilter;
    });
  });

  // Tap on media to add text
  mediaContainer.addEventListener('click', (e) => {
    if (!mediaContainer) return;
    const rect = mediaContainer.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    pendingPosition = { x, y };
    floatingTextInput.value = '';
    textInputContainer.classList.add('active');
    floatingTextInput.focus();
  });

  document.getElementById('publish-remix')?.addEventListener('click', () => publishRemix(post));
}

addTextBtn.addEventListener('click', () => {
  const text = floatingTextInput.value.trim();
  if (text && pendingPosition && mediaContainer) {
    texts.push({ text, x: pendingPosition.x, y: pendingPosition.y });
    drawText(text, pendingPosition.x, pendingPosition.y);
    pendingPosition = null;
    textInputContainer.classList.remove('active');
    floatingTextInput.value = '';
  }
});

function drawText(text: string, x: number, y: number) {
  if (!mediaContainer) return;
  const existing = mediaContainer.querySelectorAll('.text-overlay');
  const newOverlay = document.createElement('div');
  newOverlay.className = 'text-overlay';
  newOverlay.textContent = text;
  newOverlay.style.left = `${x * 100}%`;
  newOverlay.style.top = `${y * 100}%`;
  newOverlay.style.fontSize = '28px';
  mediaContainer.appendChild(newOverlay);
}

async function publishRemix(originalPost: any) {
  const user = await getCurrentUser();
  if (!user) return;

  const caption = (document.getElementById('caption-input') as HTMLTextAreaElement).value.trim();
  let mediaUrl = originalPost.media_url;
  let type = originalPost.type;

  if (type === 'image') {
    try {
      mediaUrl = await generateImageWithTexts(originalPost.media_url, texts, selectedFilter);
    } catch (err) {
      console.error(err);
      alert('Failed to generate image');
      return;
    }
  }

  const { data: newPost, error: insertError } = await supabase
    .from('posts')
    .insert({
      user_id: user.id,
      type: type,
      caption: caption,
      media_url: mediaUrl,
      source: 'remix',
    })
    .select()
    .single();

  if (insertError || !newPost) {
    console.error('Error creating remix post:', insertError);
    alert('Failed to publish remix.');
    return;
  }

  let rootPostId = originalPost.id;
  const { data: parentRemix } = await supabase
    .from('remixes')
    .select('root_post_id')
    .eq('child_post_id', originalPost.id)
    .maybeSingle();
  if (parentRemix && parentRemix.root_post_id) rootPostId = parentRemix.root_post_id;

  await supabase.from('remixes').insert({
    parent_post_id: originalPost.id,
    child_post_id: newPost.id,
    root_post_id: rootPostId,
  });

  const { data: profile } = await supabase
    .from('profiles')
    .select('remix_count')
    .eq('id', user.id)
    .single();
  if (profile) {
    await supabase
      .from('profiles')
      .update({ remix_count: (profile.remix_count || 0) + 1 })
      .eq('id', user.id);
  }

  if (originalPost.user_id !== user.id) {
    await supabase.from('notifications').insert({
      user_id: originalPost.user_id,
      actor_id: user.id,
      type: 'remix',
      reference_id: newPost.id,
    });
  }

  alert('Remix published!');
  window.location.href = 'index.html';
}

async function generateImageWithTexts(src: string, texts: Array<{text:string;x:number;y:number}>, filter: string): Promise<string> {
  const response = await fetch(src);
  if (!response.ok) throw new Error('Failed to fetch image');
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = objectUrl;
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error('Image load failed'));
  });

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  ctx.filter = filter !== 'none' ? filter : 'none';
  ctx.drawImage(img, 0, 0);
  ctx.filter = 'none';

  if (texts.length > 0) {
    ctx.font = 'bold 64px Inter, sans-serif';
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 4;
    ctx.textAlign = 'center';
    for (const t of texts) {
      ctx.strokeText(t.text, t.x * canvas.width, t.y * canvas.height);
      ctx.fillText(t.text, t.x * canvas.width, t.y * canvas.height);
    }
  }

  const outBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Canvas export failed')), 'image/jpeg', 0.9);
  });

  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  const fileName = `${user.id}/${Date.now()}-remix.jpg`;
  const { error: uploadError } = await supabase.storage
    .from('post-media')
    .upload(fileName, outBlob, { cacheControl: '3600', upsert: false });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('post-media').getPublicUrl(fileName);
  return data.publicUrl;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
