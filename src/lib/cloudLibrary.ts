import { isSupabaseConfigured, supabase } from './supabase';

export type CloudLibraryState = {
  favorites: string[];
  history: string[];
};

export type CloudProgressState = Record<string, { currentTime: number; duration: number; updatedAt: string }>;

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

export async function loadCloudProgress(): Promise<CloudProgressState | null> {
  const session = await ensureSession();
  if (!session || !supabase) return null;

  const { data, error } = await supabase
    .from('user_lecture_progress')
    .select('lecture_id, current_time, duration, updated_at')
    .eq('user_id', session.user.id);

  if (error) {
    console.warn('Supabase progress load failed; local progress remains active.', error.message);
    return null;
  }

  return Object.fromEntries((data ?? []).map((row) => [row.lecture_id, {
    currentTime: Number(row.current_time) || 0,
    duration: Number(row.duration) || 0,
    updatedAt: row.updated_at
  }]));
}

export async function saveCloudProgress(lectureId: string, currentTime: number, duration: number) {
  const session = await ensureSession();
  if (!session || !supabase) return;

  const { error } = await supabase.from('user_lecture_progress').upsert(
    {
      user_id: session.user.id,
      lecture_id: lectureId,
      current_time: Math.max(0, currentTime),
      duration: Math.max(0, duration),
      updated_at: new Date().toISOString()
    },
    { onConflict: 'user_id,lecture_id' }
  );

  if (error) console.warn('Supabase progress save failed; local progress remains active.', error.message);
}
