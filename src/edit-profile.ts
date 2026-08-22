import { supabase } from './lib/supabase.ts';
import { getCurrentUser } from './lib/auth.ts';

const container = document.getElementById('edit-container') as HTMLElement | null;

if (!container) {
  console.error('edit-container not found');
} else {
  init();
}

async function init() {
  const user = await getCurrentUser();
  if (!user) return;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    container.innerHTML = '<p>Failed to load profile.</p>';
    return;
  }

  // Fetch streak icon
  const { data: streakData } = await supabase
    .from('user_streaks')
    .select('icon')
    .eq('user_id', user.id)
    .maybeSingle();
  const streakIcon = streakData?.icon || '🔥';

  const username = profile.username || 'unknown';
  const displayName = profile.display_name || '';
  const bio = profile.bio || '';
  const avatarUrl = profile.avatar_url || '';
  const avatarLetter = (displayName || username).charAt(0).toUpperCase();

  container.innerHTML = `
    <div class="form-group">
      <label>Current Avatar</label>
      <div class="current-avatar">${avatarUrl ? `<img src="${avatarUrl}" alt="avatar" />` : avatarLetter}</div>
      <label for="avatar-file">Change Avatar</label>
      <input type="file" id="avatar-file" accept="image/*" />
    </div>
    <div class="form-group">
      <label for="display-name">Display Name</label>
      <input type="text" id="display-name" value="${escapeHtml(displayName)}" placeholder="Display name" />
    </div>
    <div class="form-group">
      <label for="bio">Bio</label>
      <textarea id="bio" rows="4" placeholder="Tell us about yourself">${escapeHtml(bio)}</textarea>
    </div>
    <div class="form-group">
      <label for="streak-icon">Streak Icon (emoji)</label>
      <input type="text" id="streak-icon" value="${escapeHtml(streakIcon)}" placeholder="🔥" />
    </div>
    <button class="btn-primary" id="save-profile">Save Changes</button>
  `;

  document.getElementById('save-profile')?.addEventListener('click', async () => {
    const newDisplayName = (document.getElementById('display-name') as HTMLInputElement).value.trim();
    const newBio = (document.getElementById('bio') as HTMLTextAreaElement).value.trim();
    const newStreakIcon = (document.getElementById('streak-icon') as HTMLInputElement).value.trim() || '🔥';
    const avatarFile = (document.getElementById('avatar-file') as HTMLInputElement).files?.[0];

    let newAvatarUrl = profile.avatar_url;

    if (avatarFile) {
      try {
        const croppedBlob = await cropAvatarToSquare(avatarFile);
        newAvatarUrl = await uploadAvatar(user.id, croppedBlob);
      } catch (err) {
        console.error(err);
        alert('Failed to upload avatar');
        return;
      }
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        display_name: newDisplayName || username,
        bio: newBio,
        avatar_url: newAvatarUrl,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating profile:', updateError);
      alert('Failed to update profile.');
      return;
    }

    // Upsert streak icon
    const { error: streakUpdateError } = await supabase
      .from('user_streaks')
      .upsert({ user_id: user.id, icon: newStreakIcon }, { onConflict: 'user_id' });

    if (streakUpdateError) {
      console.error('Error updating streak icon:', streakUpdateError);
      alert('Profile updated but streak icon failed.');
      return;
    }

    alert('Profile updated!');
    window.location.href = 'profile.html';
  });
}

async function cropAvatarToSquare(file: File): Promise<Blob> {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.src = url;
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });

  const size = Math.min(img.width, img.height);
  const sx = (img.width - size) / 2;
  const sy = (img.height - size) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = 300;
  canvas.height = 300;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  ctx.drawImage(img, sx, sy, size, size, 0, 0, 300, 300);

  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Canvas export failed')), 'image/jpeg', 0.9);
  });
}

async function uploadAvatar(userId: string, blob: Blob): Promise<string> {
  const fileName = `${userId}/avatar.jpg`;
  const { error: uploadError } = await supabase.storage
    .from('post-media')
    .upload(fileName, blob, { cacheControl: '3600', upsert: true });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('post-media').getPublicUrl(fileName);
  return data.publicUrl;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
