import { isSupabaseConfigured, supabase } from './supabase';

export type CloudLibraryState = {
  favorites: string[];
  history: string[];
};

async function ensureSession() {
  if (!supabase || !isSupabaseConfigured) return null;

  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session) return sessionData.session;

  // Anonymous auth keeps the site usable without collecting personal data.
  // Cross-device sync becomes available later when a real auth provider is enabled.
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.warn('Supabase anonymous auth is unavailable; using local storage.', error.message);
    return null;
  }
  return data.session;
}

export async function loadCloudLibrary(): Promise<CloudLibraryState | null> {
  const session = await ensureSession();
  if (!session || !supabase) return null;

  const { data, error } = await supabase
    .from('user_library_state')
    .select('favorites, history')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (error) {
    console.warn('Supabase library load failed; using local storage.', error.message);
    return null;
  }

  return data
    ? { favorites: data.favorites ?? [], history: data.history ?? [] }
    : { favorites: [], history: [] };
}

export async function saveCloudLibrary(state: CloudLibraryState) {
  const session = await ensureSession();
  if (!session || !supabase) return;

  const { error } = await supabase.from('user_library_state').upsert(
    {
      user_id: session.user.id,
      favorites: state.favorites,
      history: state.history,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'user_id' }
  );

  if (error) console.warn('Supabase library save failed; local storage remains active.', error.message);
}
