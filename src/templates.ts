import { supabase } from './lib/supabase.ts';

const grid = document.getElementById('template-grid') as HTMLElement;

async function loadTemplates() {
  grid.innerHTML = '<div class="loading">Loading templates...</div>';

  const { data: templates, error } = await supabase
    .from('templates')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching templates:', error);
    grid.innerHTML = '<p style="color:#9E9EA3;">Failed to load templates.</p>';
    return;
  }

  if (!templates || templates.length === 0) {
    grid.innerHTML = '<p style="color:#9E9EA3;">No templates yet.</p>';
    return;
  }

  grid.innerHTML = templates.map((template: any) => `
    <a href="remix.html?template=${encodeURIComponent(template.url)}" class="template-item">
      <img src="${template.url}" alt="${template.name}" loading="lazy" onerror="this.style.display='none'" />
      <div class="template-name">${template.name}</div>
    </a>
  `).join('');
}

loadTemplates();
