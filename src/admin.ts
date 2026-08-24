import { supabase } from './lib/supabase.ts';
import { getCurrentUser } from './lib/auth.ts';

const container = document.getElementById('admin-container') as HTMLElement | null;
const navButtons = document.querySelectorAll('.admin-nav button');
let currentTab = 'users';

if (!container) {
  console.error('admin-container not found');
} else {
  init();
}

async function init() {
  const user = await getCurrentUser();
  if (!user) {
    container.innerHTML = '<p class="loading">Not logged in.</p>';
    return;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    container.innerHTML = '<p class="loading">You do not have admin access.</p>';
    return;
  }

  navButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      navButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.getAttribute('data-tab') || 'users';
      loadTab(currentTab);
    });
  });

  loadTab('users');
}

async function loadTab(tab: string) {
  container.innerHTML = '<p class="loading">Loading...</p>';
  if (tab === 'users') await loadUsers();
  else if (tab === 'reports') await loadReports();
  else if (tab === 'content') await loadContent();
  else if (tab === 'metrics') await loadMetrics();
  else if (tab === 'templates') await loadTemplatesTab();
}

async function loadUsers() {
  const { data: users, error } = await supabase
    .from('profiles')
    .select('id, username, xp, role, status')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    container.innerHTML = `<p class="loading">Error: ${error.message}</p>`;
    return;
  }

  if (!users || users.length === 0) {
    container.innerHTML = '<p class="loading">No users found.</p>';
    return;
  }

  container.innerHTML = users.map((user: any) => `
    <div class="card">
      <div class="user-row">
        <div class="user-info">
          <div class="user-name">${user.username || 'unknown'}</div>
          <div class="user-email">${user.role} • ${user.status || 'active'}</div>
        </div>
        <div style="display:flex; gap:6px;">
          ${user.status !== 'suspended'
            ? `<button class="action-btn danger" data-action="suspend" data-user-id="${user.id}">Suspend</button>`
            : `<button class="action-btn success" data-action="activate" data-user-id="${user.id}">Activate</button>`}
        </div>
      </div>
    </div>
  `).join('');

  container.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    const btn = target.closest('[data-action]') as HTMLElement;
    if (!btn) return;
    const userId = btn.dataset.userId;
    const action = btn.dataset.action;
    if (action === 'suspend') await updateUserStatus(userId, 'suspended');
    else if (action === 'activate') await updateUserStatus(userId, 'active');
  });
}

async function updateUserStatus(userId: string, status: string) {
  const { error } = await supabase
    .rpc('moderate_user', { user_id: userId, new_status: status });

  if (error) {
    alert('Failed to update user: ' + error.message);
    return;
  }
  alert(`User ${status}`);
  loadTab('users');
}

async function loadReports() {
  const { data: reports, error } = await supabase
    .from('reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    container.innerHTML = `<p class="loading">Error: ${error.message}</p>`;
    return;
  }

  if (!reports || reports.length === 0) {
    container.innerHTML = '<p class="loading">No reports.</p>';
    return;
  }

  container.innerHTML = reports.map((report: any) => `
    <div class="card">
      <div class="report-row">
        <div class="user-info">
          <div class="user-name">${report.reason || 'No reason'} (${report.target_type})</div>
          <div class="user-email">Reporter: ${report.reporter_id || 'unknown'} • ${report.status}</div>
        </div>
        <div style="display:flex; gap:6px;">
          ${report.status === 'open'
            ? `<button class="action-btn danger" data-action="resolve-report" data-report-id="${report.id}">Resolve</button>`
            : `<span class="user-email">Resolved</span>`}
        </div>
      </div>
    </div>
  `).join('');

  container.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    const btn = target.closest('[data-action]') as HTMLElement;
    if (!btn) return;
    const reportId = btn.dataset.reportId;
    const action = btn.dataset.action;
    if (action === 'resolve-report') {
      await supabase.from('reports').update({ status: 'resolved' }).eq('id', reportId);
      alert('Report resolved');
      loadTab('reports');
    }
  });
}

async function loadContent() {
  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, caption, status')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    container.innerHTML = `<p class="loading">Error: ${error.message}</p>`;
    return;
  }

  if (!posts || posts.length === 0) {
    container.innerHTML = '<p class="loading">No content.</p>';
    return;
  }

  container.innerHTML = posts.map((post: any) => `
    <div class="card">
      <div class="content-row">
        <div class="user-info">
          <div class="user-name">${post.caption || 'No caption'}</div>
          <div class="user-email">Status: ${post.status}</div>
        </div>
        <div style="display:flex; gap:6px;">
          ${post.status === 'published'
            ? `<button class="action-btn danger" data-action="remove-post" data-post-id="${post.id}">Remove</button>`
            : `<button class="action-btn success" data-action="restore-post" data-post-id="${post.id}">Restore</button>`}
        </div>
      </div>
    </div>
  `).join('');

  container.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    const btn = target.closest('[data-action]') as HTMLElement;
    if (!btn) return;
    const postId = btn.dataset.postId;
    const action = btn.dataset.action;
    if (action === 'remove-post') await updatePostStatus(postId, 'removed');
    else if (action === 'restore-post') await updatePostStatus(postId, 'published');
  });
}

async function updatePostStatus(postId: string, status: string) {
  const { error } = await supabase
    .rpc('moderate_post', { post_id: postId, new_status: status });

  if (error) {
    alert('Failed to update post: ' + error.message);
    return;
  }
  alert(`Post ${status}`);
  loadTab('content');
}


async function loadTemplatesTab() {
  container.innerHTML = '<p class="loading">Loading templates...</p>';

  const { data: templates, error } = await supabase
    .from('templates')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    container.innerHTML = `<p class="loading">Error: ${error.message}</p>`;
    return;
  }

  container.innerHTML = `
    <div class="card">
      <div class="card-title">Add Template</div>
      <div class="form-group">
        <label>Template Name</label>
        <input type="text" id="template-name" placeholder="e.g., Drake" />
      </div>
      <div class="form-group">
        <label>Template Image</label>
        <input type="file" id="template-file" accept="image/*" />
      </div>
      <button class="action-btn" id="add-template-btn">Add Template</button>
    </div>
    <div id="templates-list"></div>
  `;

  document.getElementById('add-template-btn')?.addEventListener('click', async () => {
    const name = (document.getElementById('template-name') as HTMLInputElement).value.trim();
    const fileInput = document.getElementById('template-file') as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!name || !file) {
      alert('Please provide a name and select an image');
      return;
    }

    const fileName = `templates/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('post-media') // reuse existing public bucket
      .upload(fileName, file, { cacheControl: '3600', upsert: false });

    if (uploadError) {
      alert('Failed to upload image: ' + uploadError.message);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from('post-media')
      .getPublicUrl(fileName);
    const url = publicUrlData.publicUrl;

    const { error: insertError } = await supabase.from('templates').insert({ name, url });
    if (insertError) {
      alert('Failed to add template: ' + insertError.message);
      return;
    }
    alert('Template added!');
    loadTemplatesTab();
  });

  const listContainer = document.getElementById('templates-list') as HTMLElement;
  if (templates && templates.length > 0) {
    listContainer.innerHTML = templates.map((template: any) => `
      <div class="content-row">
        <div class="user-info">
          <div class="user-name">${template.name}</div>
          <div class="user-email">${template.url}</div>
        </div>
        <button class="action-btn danger" data-action="delete-template" data-template-id="${template.id}">Delete</button>
      </div>
    `).join('');

    listContainer.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      const btn = target.closest('[data-action]') as HTMLElement;
      if (!btn) return;
      if (btn.dataset.action === 'delete-template') {
        const templateId = btn.dataset.templateId;
        await supabase.from('templates').delete().eq('id', templateId);
        alert('Template deleted');
        loadTemplatesTab();
      }
    });
  } else {
    listContainer.innerHTML = '<p class="loading">No templates.</p>';
  }
}

async function loadMetrics() {
  const { count: userCount } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
  const { count: postCount } = await supabase.from('posts').select('id', { count: 'exact', head: true });
  const { count: reportCount } = await supabase.from('reports').select('id', { count: 'exact', head: true });
  const { count: commentCount } = await supabase.from('comments').select('id', { count: 'exact', head: true });

  container.innerHTML = `
    <div class="metric-grid">
      <div class="metric-card"><div class="metric-value">${userCount || 0}</div><div class="metric-label">Users</div></div>
      <div class="metric-card"><div class="metric-value">${postCount || 0}</div><div class="metric-label">Posts</div></div>
      <div class="metric-card"><div class="metric-value">${commentCount || 0}</div><div class="metric-label">Comments</div></div>
      <div class="metric-card"><div class="metric-value">${reportCount || 0}</div><div class="metric-label">Reports</div></div>
    </div>
  `;
}
