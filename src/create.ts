import { supabase } from './lib/supabase.ts';
import { getCurrentUser } from './lib/auth.ts';

const video = document.getElementById('camera-video') as HTMLVideoElement;
const cameraContainer = document.getElementById('camera-container') as HTMLElement;
const fileInput = document.getElementById('media-file') as HTMLInputElement;
const previewOverlay = document.getElementById('preview-overlay') as HTMLElement;
const previewImg = document.getElementById('preview-img') as HTMLImageElement;
const previewVideo = document.getElementById('preview-video') as HTMLVideoElement;
const cropSection = document.getElementById('crop-section') as HTMLElement;
const cropContainer = document.getElementById('crop-container') as HTMLElement;
const cropImage = document.getElementById('crop-image') as HTMLImageElement;
const zoomSlider = document.getElementById('zoom-slider') as HTMLInputElement;
const applyCropBtn = document.getElementById('apply-crop-btn') as HTMLButtonElement;
const captionInput = document.getElementById('caption') as HTMLInputElement;
const publishBtn = document.getElementById('publish-btn') as HTMLButtonElement;

let selectedFile: File | null = null;
let croppedFile: File | null = null;
let currentX = 0, currentY = 0, currentZoom = 1;
let isDragging = false, startX = 0, startY = 0, startTx = 0, startTy = 0;
let facingMode = 'user'; // 'user' (front) or 'environment' (back)
let stream: MediaStream | null = null;

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: facingMode,
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 },
      },
    });
    video.srcObject = stream;
    video.style.transform = facingMode === 'user' ? 'scaleX(-1)' : 'scaleX(1)';
  } catch (err) {
    console.warn('Camera unavailable:', err);
    cameraContainer.style.display = 'none';
  }
}

startCamera();

document.getElementById('back-btn')?.addEventListener('click', () => {
  window.location.href = 'index.html';
});

document.getElementById('flip-btn')?.addEventListener('click', async () => {
  facingMode = facingMode === 'user' ? 'environment' : 'user';
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
  await startCamera();
});

document.getElementById('capture-btn')?.addEventListener('click', () => {
  if (!video.srcObject) return;
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Capture normally; mirror if front camera
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0);

  canvas.toBlob((blob) => {
    if (blob) {
      const file = new File([blob], 'snap.jpg', { type: 'image/jpeg' });
      handleFile(file);
      // Stop camera and hide
      stream?.getTracks().forEach(track => track.stop());
      video.srcObject = null;
      cameraContainer.style.display = 'none';
    }
  }, 'image/jpeg', 0.9);
});

document.getElementById('upload-btn')?.addEventListener('click', () => fileInput.click());
document.getElementById('edit-btn')?.addEventListener('click', () => {
  // For now, edit button just opens file picker (or can later open editing tools)
  fileInput.click();
});
document.getElementById('text-btn')?.addEventListener('click', () => {
  // Placeholder for text overlay functionality
  alert('Text overlay coming soon');
});

fileInput.addEventListener('change', (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) handleFile(file);
});

function handleFile(file: File) {
  selectedFile = file;
  croppedFile = null;
  previewOverlay.classList.remove('hidden');
  cameraContainer.style.display = 'none';

  if (file.type.startsWith('image/')) {
    previewImg.src = URL.createObjectURL(file);
    previewImg.classList.remove('hidden');
    previewVideo.classList.add('hidden');
    cropSection.classList.remove('hidden');
    cropImage.src = previewImg.src;
    resetCrop();
  } else if (file.type.startsWith('video/')) {
    previewVideo.src = URL.createObjectURL(file);
    previewVideo.classList.remove('hidden');
    previewImg.classList.add('hidden');
    cropSection.classList.add('hidden');
  }
}

function resetCrop() {
  currentX = 0; currentY = 0; currentZoom = 1;
  zoomSlider.value = '1';
  updateCropTransform();
}

function updateCropTransform() {
  cropImage.style.transform = `translate(${currentX}px, ${currentY}px) scale(${currentZoom})`;
}

zoomSlider.addEventListener('input', () => {
  currentZoom = parseFloat(zoomSlider.value);
  updateCropTransform();
});

cropContainer.addEventListener('pointerdown', (e) => {
  isDragging = true;
  startX = e.clientX; startY = e.clientY;
  startTx = currentX; startTy = currentY;
  cropContainer.setPointerCapture(e.pointerId);
});

cropContainer.addEventListener('pointermove', (e) => {
  if (!isDragging) return;
  const dx = e.clientX - startX;
  const dy = e.clientY - startY;
  currentX = startTx + dx;
  currentY = startTy + dy;
  updateCropTransform();
});

cropContainer.addEventListener('pointerup', () => { isDragging = false; });

applyCropBtn.addEventListener('click', async () => {
  if (!selectedFile || !selectedFile.type.startsWith('image/')) return;
  try {
    croppedFile = await cropImageInteractive(selectedFile, currentX, currentY, currentZoom);
    previewImg.src = URL.createObjectURL(croppedFile);
    cropSection.classList.add('hidden');
  } catch (err) {
    console.error(err);
    alert('Failed to crop image');
  }
});

publishBtn.addEventListener('click', async () => {
  const fileToUpload = croppedFile || selectedFile;
  if (!fileToUpload) {
    alert('Please select or capture media');
    return;
  }

  publishBtn.disabled = true;
  publishBtn.textContent = 'Publishing...';

  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const isVideo = fileToUpload.type.startsWith('video/');
    const type = isVideo ? 'video' : 'image';
    const fileExt = fileToUpload.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg');
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('post-media')
      .upload(fileName, fileToUpload, { cacheControl: '3600', upsert: false });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from('post-media')
      .getPublicUrl(fileName);

    const mediaUrl = publicUrlData.publicUrl;

    const { error: insertError } = await supabase
      .from('posts')
      .insert({
        user_id: user.id,
        type: type,
        caption: captionInput.value.trim(),
        media_url: mediaUrl,
        source: 'original',
      });

    if (insertError) throw insertError;

    alert('Post published!');
    window.location.href = 'index.html';
  } catch (error: any) {
    console.error(error);
    alert('Error publishing: ' + (error.message || 'Unknown error'));
  } finally {
    publishBtn.disabled = false;
    publishBtn.textContent = 'Publish Meme';
  }
});

async function cropImageInteractive(file: File, tx: number, ty: number, zoom: number): Promise<File> {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.src = url;
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });

  const targetAspect = 4 / 3;
  const containerWidth = 800;
  const containerHeight = 600;
  const canvas = document.createElement('canvas');
  canvas.width = containerWidth;
  canvas.height = containerHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  const naturalW = img.naturalWidth;
  const naturalH = img.naturalHeight;
  const naturalAspect = naturalW / naturalH;
  let renderedW, renderedH, offsetX, offsetY;
  if (naturalAspect > targetAspect) {
    renderedW = containerWidth;
    renderedH = containerWidth / naturalAspect;
    offsetX = 0;
    offsetY = (containerHeight - renderedH) / 2;
  } else {
    renderedH = containerHeight;
    renderedW = containerHeight * naturalAspect;
    offsetY = 0;
    offsetX = (containerWidth - renderedW) / 2;
  }

  const cropAreaW = containerWidth * 0.8;
  const cropAreaH = containerHeight * 0.8;
  const cropCenterX = containerWidth / 2;
  const cropCenterY = containerHeight / 2;
  const cropLeft = cropCenterX - cropAreaW / 2;
  const cropTop = cropCenterY - cropAreaH / 2;

  const sourceX = (cropLeft - (offsetX + renderedW/2 + tx)) / zoom + naturalW / 2;
  const sourceY = (cropTop - (offsetY + renderedH/2 + ty)) / zoom + naturalH / 2;
  const sourceW = cropAreaW / zoom;
  const sourceH = cropAreaH / zoom;
  const sx = Math.max(0, Math.min(sourceX, naturalW));
  const sy = Math.max(0, Math.min(sourceY, naturalH));
  const sw = Math.min(sourceW, naturalW - sx);
  const sh = Math.min(sourceH, naturalH - sy);

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, containerWidth, containerHeight);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Canvas export failed')), 'image/jpeg', 0.9);
  });
  return new File([blob], 'cropped.jpg', { type: 'image/jpeg' });
}
