import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('https://'));

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Fetch state from Supabase database (or return null if not configured)
export const fetchSupabaseState = async () => {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('isthooi_app_state')
      .select('state_data')
      .eq('id', 'primary_state')
      .single();

    if (error) {
      console.warn('Supabase fetch error:', error.message);
      return null;
    }

    if (data && data.state_data && Object.keys(data.state_data).length > 0) {
      return data.state_data;
    }
    return null;
  } catch (err) {
    console.error('Failed to fetch from Supabase:', err);
    return null;
  }
};

// Sync state to Supabase database (debounce/async save)
export const syncStateToSupabase = async (state) => {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('isthooi_app_state')
      .upsert({
        id: 'primary_state',
        state_data: state,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.warn('Supabase sync error:', error.message);
    }
  } catch (err) {
    console.error('Failed to sync to Supabase:', err);
  }
};
