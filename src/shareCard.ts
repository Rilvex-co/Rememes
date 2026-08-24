import { supabase } from './lib/supabase.ts';

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

async function loadMedia(url: string, type: 'image' | 'video'): Promise<HTMLImageElement | HTMLVideoElement> {
  const response = await fetch(url);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  if (type === 'image') {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = objectUrl;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Image load failed'));
    });
    return img;
  } else {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.src = objectUrl;
    video.muted = true;
    video.playsInline = true;
    await new Promise((resolve, reject) => {
      video.onloadeddata = () => {
        video.currentTime = Math.min(0.1, video.duration || 0.1);
        setTimeout(resolve, 200);
      };
      video.onerror = () => reject(new Error('Video load failed'));
    });
    return video;
  }
}

export async function generateShareCard(post: any): Promise<File> {
  // Fetch profile for username and avatar
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_url')
    .eq('id', post.user_id)
    .single();

  const username = profile?.username || 'unknown';
  const displayName = profile?.display_name || username;
  const avatarUrl = profile?.avatar_url || '';
  const caption = post.caption || '';

  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d')!;

  // 1. Background: dark gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#0A0A0B');
  gradient.addColorStop(1, '#1A1A1D');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Load media
  let media: HTMLImageElement | HTMLVideoElement;
  try {
    media = await loadMedia(post.media_url, post.type as 'image' | 'video');
  } catch (error) {
    console.error('Failed to load media for share card:', error);
    // Fallback: placeholder text
    ctx.fillStyle = '#F5F5F7';
    ctx.font = 'bold 40px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Meme not available', canvas.width / 2, canvas.height / 2);
    ctx.textAlign = 'left';
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))), 'image/png')
    );
    return new File([blob], 'share.png', { type: 'image/png' });
  }

  // 3. Blurred background from media
  ctx.save();
  ctx.filter = 'blur(50px) brightness(0.4)';
  if (media instanceof HTMLImageElement) {
    ctx.drawImage(media, 0, 0, canvas.width, canvas.height);
  } else {
    ctx.drawImage(media, 0, 0, canvas.width, canvas.height);
  }
  ctx.restore();

  // 4. Floating post card dimensions
  const cardWidth = 880;
  const cardPadding = 40;
  const headerHeight = 100;
  const footerHeight = 120;
  const captionHeight = caption ? 80 : 20;
  const mediaAspect = media instanceof HTMLImageElement
    ? media.naturalWidth / media.naturalHeight
    : media.videoWidth / media.videoHeight;
  const mediaHeight = Math.min(800, cardWidth / mediaAspect);
  const cardHeight = headerHeight + mediaHeight + captionHeight + footerHeight;
  const cardX = (canvas.width - cardWidth) / 2;
  const cardY = (canvas.height - cardHeight) / 2;

  // 5. Card background with rounded corners
  ctx.fillStyle = 'rgba(10,10,11,0.85)';
  drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 30);
  ctx.fill();

  // 6. Card border (silver)
  ctx.strokeStyle = '#C7C7CC';
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 30);
  ctx.stroke();

  // 7. Header: avatar + username
  const headerY = cardY + cardPadding;
  if (avatarUrl) {
    try {
      const avatarResponse = await fetch(avatarUrl);
      const avatarBlob = await avatarResponse.blob();
      const avatarObjectUrl = URL.createObjectURL(avatarBlob);
      const avatarImg = new Image();
      avatarImg.crossOrigin = 'anonymous';
      avatarImg.src = avatarObjectUrl;
      await new Promise((resolve, reject) => {
        avatarImg.onload = resolve;
        avatarImg.onerror = () => reject(new Error('Avatar load failed'));
      });
      ctx.save();
      ctx.beginPath();
      ctx.arc(cardX + cardPadding + 25, headerY + 25, 25, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(avatarImg, cardX + cardPadding, headerY, 50, 50);
      ctx.restore();
    } catch (err) {
      console.warn('Avatar load failed, using initial fallback:', err);
      // Use fallback initial
      ctx.fillStyle = '#212125';
      ctx.beginPath();
      ctx.arc(cardX + cardPadding + 25, headerY + 25, 25, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F5F5F7';
      ctx.font = 'bold 24px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(displayName.charAt(0).toUpperCase(), cardX + cardPadding + 25, headerY + 33);
      ctx.textAlign = 'left';
    }
  } else {
    ctx.fillStyle = '#212125';
    ctx.beginPath();
    ctx.arc(cardX + cardPadding + 25, headerY + 25, 25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#F5F5F7';
    ctx.font = 'bold 24px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(displayName.charAt(0).toUpperCase(), cardX + cardPadding + 25, headerY + 33);
    ctx.textAlign = 'left';
  }

  ctx.fillStyle = '#F5F5F7';
  ctx.font = 'bold 32px Inter, sans-serif';
  ctx.fillText(displayName, cardX + cardPadding + 70, headerY + 33);

  // 8. Media area
  const mediaX = cardX + cardPadding;
  const mediaY = headerY + 70;
  const mediaW = cardWidth - cardPadding * 2;
  const mediaH = mediaHeight;

  ctx.save();
  if (media instanceof HTMLImageElement) {
    // Cover fit preserving aspect ratio
    const scale = Math.max(mediaW / media.naturalWidth, mediaH / media.naturalHeight);
    const sw = mediaW / scale;
    const sh = mediaH / scale;
    const sx = (media.naturalWidth - sw) / 2;
    const sy = (media.naturalHeight - sh) / 2;
    ctx.drawImage(media, sx, sy, sw, sh, mediaX, mediaY, mediaW, mediaH);
  } else {
    const scale = Math.max(mediaW / media.videoWidth, mediaH / media.videoHeight);
    const sw = mediaW / scale;
    const sh = mediaH / scale;
    const sx = (media.videoWidth - sw) / 2;
    const sy = (media.videoHeight - sh) / 2;
    ctx.drawImage(media, sx, sy, sw, sh, mediaX, mediaY, mediaW, mediaH);
    // Play icon overlay
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(mediaX + mediaW / 2, mediaY + mediaH / 2, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0A0A0B';
    ctx.beginPath();
    ctx.moveTo(mediaX + mediaW / 2 - 15, mediaY + mediaH / 2 - 25);
    ctx.lineTo(mediaX + mediaW / 2 + 30, mediaY + mediaH / 2);
    ctx.lineTo(mediaX + mediaW / 2 - 15, mediaY + mediaH / 2 + 25);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // 9. Caption area
  const captionY = mediaY + mediaH + 20;
  ctx.fillStyle = '#9E9EA3';
  ctx.font = '28px Inter, sans-serif';
  const captionLines = wrapText(ctx, caption, cardWidth - cardPadding * 2);
  captionLines.forEach((line, index) => {
    ctx.fillText(line, cardX + cardPadding, captionY + index * 34);
  });

  // 10. Footer: branding and deep link
  const footerY = cardY + cardHeight - footerHeight + 30;
  ctx.fillStyle = '#6E6E73';
  ctx.font = 'bold 28px Inter, sans-serif';
  ctx.fillText('Shared from Rememes', cardX + cardPadding, footerY);

  // Draw a small arrow icon indicating clickability (no raw URL)
  ctx.font = '24px Inter, sans-serif';
  ctx.fillStyle = '#9E9EA3';
  ctx.fillText('↗ View post', cardX + cardPadding, footerY + 40);

  // 11. Final export
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))), 'image/png')
  );

  return new File([blob], 'rememes-share.png', { type: 'image/png' });
}
