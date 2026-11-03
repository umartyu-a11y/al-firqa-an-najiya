import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './supabase';

export type AuthListener = (event: AuthChangeEvent, session: Session | null) => void;

export async function getAuthSession() {
  if (!supabase || !isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function subscribeToAuth(listener: AuthListener) {
  if (!supabase || !isSupabaseConfigured) return () => undefined;
  const { data } = supabase.auth.onAuthStateChange(listener);
  return () => data.subscription.unsubscribe();
}

export async function requestPersistentAccess(email: string) {
  if (!supabase || !isSupabaseConfigured) return { error: 'Supabase не настроен.' };

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
  if (!supabase || !isSupabaseConfigured) return;
  await supabase.auth.signOut();
}
