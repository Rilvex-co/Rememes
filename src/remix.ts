import { supabase } from './lib/supabase.ts';
import { getCurrentUser } from './lib/auth.ts';

const container = document.getElementById('editor-container') as HTMLElement | null;
const urlParams = new URLSearchParams(window.location.search);
const postId = urlParams.get('id');
const templateUrl = urlParams.get('template');

let originalPost: any = null;
let selectedFilter = 'none';
let mediaContainer: HTMLElement | null = null;
let mediaElement: HTMLImageElement | HTMLVideoElement | null = null;
let texts: Array<{ text: string; x: number; y: number; fontSize: number }> = [];
let activeTextIndex: number | null = null;
let isEditing = false;

if (!container || (!postId && !templateUrl)) {
  if (container) container.innerHTML = '<p>Invalid remix request.</p>';
} else {
  init();
}

async function init() {
  const user = await getCurrentUser();
  if (!user) return;

  if (templateUrl) {
    originalPost = { id: null, user_id: user.id, type: 'image', caption: '', media_url: templateUrl };
    renderEditor(originalPost);
  } else if (postId) {
    const { data: post, error } = await supabase.from('posts').select('*').eq('id', postId).single();
    if (error || !post) {
      container.innerHTML = '<p>Post not found.</p>';
      return;
    }
    originalPost = post;
    renderEditor(post);
  }
}

function renderEditor(post: any) {
  const isImage = post.type === 'image';
  container.innerHTML = `
    <div class="editor-media" id="editor-media">
      ${isImage ? `<img id="media-img" src="${post.media_url}" alt="remix" />` : `<video id="media-video" src="${post.media_url}" controls></video>`}
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
    <button class="btn-primary" id="publish-remix">Publish</button>
  `;

  mediaContainer = document.getElementById('editor-media') as HTMLElement;
  mediaElement = isImage ? document.getElementById('media-img') as HTMLImageElement : document.getElementById('media-video') as HTMLVideoElement;

  // Filters
  const filterButtons = document.querySelectorAll('.filter-btn');
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedFilter = btn.dataset.filter || 'none';
      if (mediaElement) mediaElement.style.filter = selectedFilter;
    });
  });

  // Tap on media to add/edit text
  mediaContainer.addEventListener('dblclick', (e) => {
    const target = e.target as HTMLElement;
    const overlay = target.closest('.text-overlay') as HTMLElement | null;
    if (overlay) {
      const index = overlay.dataset.index ? parseInt(overlay.dataset.index) : -1;
      if (index >= 0 && texts[index]) {
        editTextOverlay(overlay, index);
      }
    }
  });

  mediaContainer.addEventListener('click', (e) => {
    if (!mediaContainer) return;
    const target = e.target as HTMLElement;
    const existingOverlay = target.closest('.text-overlay') as HTMLElement | null;

    if (existingOverlay) {
      // Edit existing text
      const index = existingOverlay.dataset.index ? parseInt(existingOverlay.dataset.index) : -1;
      if (index >= 0 && texts[index]) {
        editTextOverlay(existingOverlay, index);
      }
    } else if (!target.closest('.delete-btn')) {
      // Add new text at tap position
      const rect = mediaContainer.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      createTextOverlayAt(x, y);
    }
  });

  document.getElementById('publish-remix')?.addEventListener('click', () => publishRemix(post));
}

function createTextOverlayAt(x: number, y: number) {
  if (!mediaContainer) return;
  const overlay = document.createElement('div');
  overlay.className = 'text-overlay';
  overlay.contentEditable = 'true';
  overlay.spellcheck = false;
  overlay.style.cssText = `
    position: absolute;
    left: ${x * 100}%;
    top: ${y * 100}%;
    font-size: 28px;
    font-weight: 800;
    color: white;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
    cursor: move;
    touch-action: none;
    user-select: none;
    pointer-events: auto;
    z-index: 10;
    transform: translate(-50%, -50%);
    min-width: 40px;
    outline: none;
  `;
  overlay.textContent = '';
  mediaContainer.appendChild(overlay);
  overlay.focus();
  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(overlay);
  sel?.removeAllRanges();
  sel?.addRange(range);

  // On blur or Enter, commit text
  const commit = () => {
    overlay.contentEditable = 'false';
    const text = overlay.textContent?.trim() || '';
    if (!text) {
      overlay.remove();
      return;
    }
    texts.push({ text, x, y, fontSize: 28 });
    overlay.dataset.index = String(texts.length - 1);
    overlay.style.cursor = 'move';
    // Add delete button
    const deleteBtn = document.createElement('span');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '×';
    deleteBtn.style.cssText = 'position:absolute; top:-10px; right:-10px; width:24px; height:24px; background:#FF453A; color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:14px; cursor:pointer; z-index:20;';
    overlay.appendChild(deleteBtn);
    deleteBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const idx = parseInt(overlay.dataset.index || '-1');
      texts = texts.filter((_, i) => i !== idx);
      overlay.remove();
    });
    // Make draggable/resizable
    enableDragResize(overlay);
  };

  overlay.addEventListener('blur', commit);
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      overlay.blur();
    }
    e.stopPropagation();
  });
}

function editTextOverlay(overlay: HTMLElement, index: number) {
  overlay.contentEditable = 'true';
  overlay.focus();
  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(overlay);
  sel?.removeAllRanges();
  sel?.addRange(range);

  const commit = () => {
    overlay.contentEditable = 'false';
    const newText = overlay.textContent?.replace('×', '').trim() || '';
    if (!newText) {
      overlay.remove();
      texts = texts.filter((_, i) => i !== index);
      return;
    }
    texts[index].text = newText;
    overlay.dataset.index = String(index);
    // Ensure delete button remains after text edit
    if (!overlay.querySelector('.delete-btn')) {
      const deleteBtn = document.createElement('span');
      deleteBtn.className = 'delete-btn';
      deleteBtn.textContent = '×';
      deleteBtn.style.cssText = 'position:absolute; top:-10px; right:-10px; width:24px; height:24px; background:#FF453A; color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:14px; cursor:pointer; z-index:20;';
      overlay.appendChild(deleteBtn);
      deleteBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = parseInt(overlay.dataset.index || '-1');
        texts = texts.filter((_, i) => i !== idx);
        overlay.remove();
      });
    }
    enableDragResize(overlay);
  };

  overlay.addEventListener('blur', commit);
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      overlay.blur();
    }
    e.stopPropagation();
  });
}

function enableDragResize(overlay: HTMLElement) {
  let isDragging = false;
  let isResizing = false;
  let startX = 0, startY = 0, origLeft = 0, origTop = 0, origFontSize = 28;

  overlay.addEventListener('pointerdown', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('delete-btn')) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (target.classList.contains('resize-handle')) {
      isResizing = true;
      startY = e.clientY;
      origFontSize = parseInt(overlay.style.fontSize) || 28;
    } else {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      origLeft = parseFloat(overlay.style.left) / mediaContainer!.clientWidth * 100;
      origTop = parseFloat(overlay.style.top) / mediaContainer!.clientHeight * 100;
    }
    overlay.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  overlay.addEventListener('pointermove', (e) => {
    if (!mediaContainer) return;
    const rect = mediaContainer.getBoundingClientRect();
    if (isDragging) {
      const dx = (e.clientX - startX) / rect.width * 100;
      const dy = (e.clientY - startY) / rect.height * 100;
      let newLeft = Math.min(90, Math.max(10, origLeft + dx));
      let newTop = Math.min(90, Math.max(10, origTop + dy));
      overlay.style.left = `${newLeft}%`;
      overlay.style.top = `${newTop}%`;
      const idx = parseInt(overlay.dataset.index || '-1');
      if (idx >= 0 && texts[idx]) {
        texts[idx].x = newLeft / 100;
        texts[idx].y = newTop / 100;
      }
    } else if (isResizing) {
      const dy = e.clientY - startY;
      const newFontSize = Math.min(120, Math.max(12, origFontSize + dy * 0.5));
      overlay.style.fontSize = `${newFontSize}px`;
      const idx = parseInt(overlay.dataset.index || '-1');
      if (idx >= 0 && texts[idx]) {
        texts[idx].fontSize = newFontSize;
      }
    }
  });

  overlay.addEventListener('pointerup', () => {
    isDragging = false;
    isResizing = false;
  });

  // Ensure delete button exists
  if (!overlay.querySelector('.delete-btn')) {
    const deleteBtn = document.createElement('span');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '×';
    deleteBtn.style.cssText = 'position:absolute; top:-10px; right:-10px; width:24px; height:24px; background:#FF453A; color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:14px; cursor:pointer; z-index:20;';
    overlay.appendChild(deleteBtn);
    deleteBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const idx = parseInt(overlay.dataset.index || '-1');
      texts = texts.filter((_, i) => i !== idx);
      overlay.remove();
    });
  }

  // Add resize handle if not exists
  if (!overlay.querySelector('.resize-handle')) {
    const handle = document.createElement('span');
    handle.className = 'resize-handle';
    handle.style.cssText = 'position:absolute; bottom:-8px; right:-8px; width:20px; height:20px; background:#FFF; border:2px solid #C7C7CC; border-radius:50%; cursor: nwse-resize; touch-action: none; pointer-events: auto;';
    overlay.appendChild(handle);
  }
}

async function publishRemix(originalPost: any) {
  const user = await getCurrentUser();
  if (!user) return;

  const caption = (document.getElementById('caption-input') as HTMLTextAreaElement).value.trim();
  let mediaUrl = originalPost.media_url;
  let type = originalPost.type;

  if (type === 'image' && (texts.length > 0 || selectedFilter !== 'none')) {
    try {
      mediaUrl = await generateImageWithTexts(originalPost.media_url, texts, selectedFilter);
    } catch (err) {
      console.error(err);
      alert('Failed to generate image: ' + (err instanceof Error ? err.message : 'Unknown error'));
      return;
    }
  }

  if (!originalPost.id) {
    const { data: newPost, error: insertError } = await supabase
      .from('posts')
      .insert({ user_id: user.id, type: type, caption: caption, media_url: mediaUrl, source: 'original' })
      .select()
      .single();
    if (insertError || !newPost) {
      alert('Failed to publish.');
      return;
    }
    alert('Published!');
    window.location.href = 'index.html';
    return;
  }

  const { data: newPost, error: insertError } = await supabase
    .from('posts')
    .insert({ user_id: user.id, type: type, caption: caption, media_url: mediaUrl, source: 'remix' })
    .select()
    .single();
  if (insertError || !newPost) {
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

  await supabase.from('remixes').insert({ parent_post_id: originalPost.id, child_post_id: newPost.id, root_post_id: rootPostId });

  const { data: profile } = await supabase
    .from('profiles')
    .select('remix_count')
    .eq('id', user.id)
    .single();
  if (profile) {
    await supabase.from('profiles').update({ remix_count: (profile.remix_count || 0) + 1 }).eq('id', user.id);
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

async function generateImageWithTexts(src: string, texts: Array<{text:string;x:number;y:number;fontSize?:number}>, filter: string): Promise<string> {
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
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 4;
    ctx.textAlign = 'center';
    for (const t of texts) {
      const fontSize = t.fontSize || 64;
      const scaledFontSize = fontSize * (canvas.width / 480);
      ctx.font = `bold ${scaledFontSize}px Inter, sans-serif`;
      ctx.strokeText(t.text, t.x * canvas.width, t.y * canvas.height);
      ctx.fillText(t.text, t.x * canvas.width, t.y * canvas.height);
    }
  }

  const outBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Canvas export failed')), 'image/jpeg', 0.9);
  });

  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  const fileName = `${user.id}/${Date.now()}-template.jpg`;
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
