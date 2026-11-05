import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured } from './supabaseConfig';

export type CloudLibraryState = {
  favorites: string[];
  history: string[];
};

export type CloudProgressState = Record<string, { currentTime: number; duration: number; updatedAt: string }>;

type CloudContext = { client: SupabaseClient; session: Session };

async function ensureSession(): Promise<CloudContext | null> {
  if (!isSupabaseConfigured) return null;

  let client: SupabaseClient | null;
  try {
    ({ supabase: client } = await import('./supabase'));
  } catch (error) {
    console.warn('Supabase sync module could not be loaded; using local storage.', error);
    return null;
  }
  if (!client) return null;

  const { data: sessionData } = await client.auth.getSession();
  if (sessionData.session) return { client, session: sessionData.session };

  // Anonymous auth keeps the site usable without collecting personal data.
  // Cross-device sync becomes available later when a real auth provider is enabled.
  const { data, error } = await client.auth.signInAnonymously();
  if (error) {
    console.warn('Supabase anonymous auth is unavailable; using local storage.', error.message);
    return null;
  }
  return data.session ? { client, session: data.session } : null;
}

export async function loadCloudLibrary(): Promise<CloudLibraryState | null> {
  const context = await ensureSession();
  if (!context) return null;
  const { client, session } = context;

  const { data, error } = await client
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
  const context = await ensureSession();
  if (!context) return;
  const { client, session } = context;

  const { error } = await client.from('user_library_state').upsert(
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
  const context = await ensureSession();
  if (!context) return null;
  const { client, session } = context;

  const { data, error } = await client
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
  const context = await ensureSession();
  if (!context) return;
  const { client, session } = context;

  const { error } = await client.from('user_lecture_progress').upsert(
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
