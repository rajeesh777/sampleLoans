import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('https://'));

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

let syncInProgress = false;
let lastSyncTime = null;
let lastSyncStatus = 'idle'; // 'idle', 'syncing', 'success', 'error'

export const getSyncStatus = () => ({
  isConfigured: isSupabaseConfigured,
  isConnected: syncInProgress,
  lastSyncTime,
  status: lastSyncStatus
});

// Fetch state from Supabase database (or return null if not configured)
export const fetchSupabaseState = async () => {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('isthooi_app_state')
      .select('state_data, updated_at')
      .eq('id', 'primary_state')
      .single();

    if (error) {
      console.warn('Supabase fetch error:', error.message);
      lastSyncStatus = 'error';
      return null;
    }

    if (data && data.state_data && Object.keys(data.state_data).length > 0) {
      lastSyncTime = data.updated_at;
      lastSyncStatus = 'success';
      return data.state_data;
    }
    return null;
  } catch (err) {
    console.error('Failed to fetch from Supabase:', err);
    lastSyncStatus = 'error';
    return null;
  }
};

// Sync state to Supabase database (debounce/async save)
export const syncStateToSupabase = async (state) => {
  if (!supabase) return false;

  if (syncInProgress) {
    console.log('Sync already in progress, skipping...');
    return false;
  }

  syncInProgress = true;
  lastSyncStatus = 'syncing';

  try {
    const { error } = await supabase
      .from('isthooi_app_state')
      .upsert({
        id: 'primary_state',
        state_data: state,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      });

    if (error) {
      console.warn('Supabase sync error:', error.message);
      lastSyncStatus = 'error';
      syncInProgress = false;
      return false;
    }

    lastSyncTime = new Date().toISOString();
    lastSyncStatus = 'success';
    syncInProgress = false;
    console.log('✓ State synced to Supabase');
    return true;
  } catch (err) {
    console.error('Failed to sync to Supabase:', err);
    lastSyncStatus = 'error';
    syncInProgress = false;
    return false;
  }
};

// Manual force sync
export const forceSync = async (state) => {
  lastSyncStatus = 'syncing';
  syncInProgress = true;
  const result = await syncStateToSupabase(state);
  return result;
};

// Check Supabase connection status
export const checkSupabaseConnection = async () => {
  if (!supabase) {
    return {
      connected: false,
      message: 'Supabase not configured'
    };
  }

  try {
    const { data, error } = await supabase
      .from('isthooi_app_state')
      .select('id')
      .limit(1);

    if (error) {
      return {
        connected: false,
        message: `Connection failed: ${error.message}`
      };
    }

    return {
      connected: true,
      message: 'Connected to Supabase'
    };
  } catch (err) {
    return {
      connected: false,
      message: `Error: ${err.message}`
    };
  }
};
