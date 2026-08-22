import { supabase } from './lib/supabase.ts';
import { getCurrentUser } from './lib/auth.ts';

async function guard() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    window.location.href = 'index.html';
  }
}

guard();
