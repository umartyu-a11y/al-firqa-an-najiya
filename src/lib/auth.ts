import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured } from './supabaseConfig';

export type AuthListener = (event: AuthChangeEvent, session: Session | null) => void;

async function getConfiguredClient() {
  if (!isSupabaseConfigured) return null;
  try {
    const { supabase } = await import('./supabase');
    return supabase;
  } catch (error) {
    console.warn('Supabase auth module could not be loaded.', error);
    return null;
  }
}

export async function getAuthSession() {
  const supabase = await getConfiguredClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function subscribeToAuth(listener: AuthListener) {
  if (!isSupabaseConfigured) return () => undefined;

  let cancelled = false;
  let unsubscribe: (() => void) | null = null;

  void getConfiguredClient()
    .then((supabase) => {
      if (!supabase || cancelled) return;
      const { data } = supabase.auth.onAuthStateChange(listener);
      unsubscribe = () => data.subscription.unsubscribe();
    })
    .catch((error) => console.warn('Supabase auth could not be loaded.', error));

  return () => {
    cancelled = true;
    unsubscribe?.();
  };
}

export async function requestPersistentAccess(email: string) {
  const supabase = await getConfiguredClient();
  if (!supabase) return { error: 'Supabase не настроен.' };

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes('@')) return { error: 'Введите корректный email.' };

  const { data: userData } = await supabase.auth.getUser();
  const currentUser = userData.user as (User & { is_anonymous?: boolean }) | null;

  // Upgrade the current anonymous identity where possible. This keeps the
  // same user_id and therefore preserves the cloud library row automatically.
  if (currentUser?.is_anonymous) {
    const { error } = await supabase.auth.updateUser({ email: normalizedEmail });
    return error ? { error: error.message } : { error: null };
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: normalizedEmail,
    options: { emailRedirectTo: window.location.origin + window.location.pathname }
  });
  return error ? { error: error.message } : { error: null };
}

export async function signOutUser() {
  const supabase = await getConfiguredClient();
  if (!supabase) return;
  await supabase.auth.signOut();
}
