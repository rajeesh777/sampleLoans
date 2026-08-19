import { createClient } from '@supabase/supabase-js';

// The whole-state upsert that used to live here has been removed. It wrote the
// entire app state as one JSON blob on every change, so two people recording
// payments at the same time meant one of them silently lost all their work.
// Reads and writes now go through src/utils/db.js, one row at a time.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';

// Accept either name: the README and CLAUDE.md documented VITE_SUPABASE_KEY while
// the code read VITE_SUPABASE_ANON_KEY, and a mismatch silently drops the app into
// local-only mode with no error. Both work now.
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('https://')
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // Keeps the member signed in across reloads, and refreshes the JWT before
        // it lapses so a long Sunday collection session does not drop out.
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'ISTHOOI_AUTH'
      }
    })
  : null;

// Surfaced in Settings so the group can tell at a glance whether they are looking
// at live shared data or a local-only copy.
export const checkSupabaseConnection = async () => {
  if (!supabase) {
    return { connected: false, message: 'Not configured — running on this device only' };
  }

  try {
    const { error } = await supabase.from('group_settings').select('id').limit(1);
    if (error) {
      return { connected: false, message: `Connection failed: ${error.message}` };
    }
    return { connected: true, message: 'Connected' };
  } catch (err) {
    return { connected: false, message: `Error: ${err.message}` };
  }
};
