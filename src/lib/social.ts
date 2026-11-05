import { isSupabaseConfigured } from './supabaseConfig';

export type SocialProfileStatus = 'pending' | 'approved' | 'rejected';

export type SocialProfile = {
  user_id: string;
  handle: string;
  display_name: string;
  bio: string | null;
  status: SocialProfileStatus;
  created_at: string;
  updated_at: string;
};

export type SocialPublicProfile = {
  handle: string;
  display_name: string;
  bio: string;
  created_at: string;
};

export type SocialPost = {
  id: string;
  body: string;
  created_at: string;
  author_handle: string;
  author_name: string;
  reaction_count: number;
  comment_count: number;
};

export type SocialComment = {
  id: string;
  post_id: string;
  body: string;
  created_at: string;
  author_handle: string;
  author_name: string;
};

export type SocialModerationQueue = {
  profiles: Array<Pick<SocialProfile, 'user_id' | 'handle' | 'display_name' | 'bio' | 'created_at'>>;
  posts: Array<{ id: string; author_id: string; body: string; created_at: string }>;
  comments: Array<{ id: string; post_id: string; author_id: string; body: string; created_at: string }>;
  reports: Array<{
    id: string;
    reporter_id: string;
    target_post_id: string | null;
    target_comment_id: string | null;
    target_profile_user_id: string | null;
    reason: string;
    details: string | null;
    created_at: string;
  }>;
};

export type SocialReportTarget = 'post' | 'comment' | 'profile';
export type SocialReportReason = 'spam' | 'abuse' | 'unverified_religious_claim' | 'privacy' | 'other';

async function getClient() {
  if (!isSupabaseConfigured) throw new Error('SOCIAL_BACKEND_UNAVAILABLE');
  const { supabase } = await import('./supabase');
  if (!supabase) throw new Error('SOCIAL_BACKEND_UNAVAILABLE');
  return supabase;
}

function ensureSuccess(error: unknown) {
  if (error) throw new Error('SOCIAL_REQUEST_FAILED');
}

export async function loadPublicSocialFeed(): Promise<SocialPost[]> {
  const client = await getClient();
  const { data, error } = await client
    .from('social_public_feed')
    .select('id, body, created_at, author_handle, author_name, reaction_count, comment_count')
    .order('created_at', { ascending: false })
    .limit(30);
  ensureSuccess(error);
  return (data ?? []) as SocialPost[];
}

export async function loadPublicSocialProfiles(): Promise<SocialPublicProfile[]> {
  const client = await getClient();
  const { data, error } = await client
    .from('social_public_profiles')
    .select('handle, display_name, bio, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  ensureSuccess(error);
  return (data ?? []) as SocialPublicProfile[];
}

export async function loadMySocialProfile(userId: string): Promise<SocialProfile | null> {
  const client = await getClient();
  const { data, error } = await client
    .from('social_profiles')
    .select('user_id, handle, display_name, bio, status, created_at, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  ensureSuccess(error);
  return (data ?? null) as SocialProfile | null;
}

export async function loadMySocialReactions(userId: string): Promise<string[]> {
  const client = await getClient();
  const { data, error } = await client
    .from('social_reactions')
    .select('post_id')
    .eq('user_id', userId);
  ensureSuccess(error);
  return (data ?? []).map((row: { post_id: string }) => row.post_id);
}

export async function loadPublicSocialComments(postId: string): Promise<SocialComment[]> {
  const client = await getClient();
  const { data, error } = await client
    .from('social_public_comments')
    .select('id, post_id, body, created_at, author_handle, author_name')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .limit(100);
  ensureSuccess(error);
  return (data ?? []) as SocialComment[];
}

export async function submitSocialProfile(input: { handle: string; displayName: string; bio: string }): Promise<SocialProfile> {
  const client = await getClient();
  const { data, error } = await client.rpc('social_submit_profile', {
    p_handle: input.handle,
    p_display_name: input.displayName,
    p_bio: input.bio || null
  });
  ensureSuccess(error);
  return data as SocialProfile;
}

export async function submitSocialPost(body: string): Promise<string> {
  const client = await getClient();
  const { data, error } = await client.rpc('social_submit_post', { p_body: body });
  ensureSuccess(error);
  return data as string;
}

export async function submitSocialComment(postId: string, body: string): Promise<string> {
  const client = await getClient();
  const { data, error } = await client.rpc('social_submit_comment', { p_post_id: postId, p_body: body });
  ensureSuccess(error);
  return data as string;
}

export async function toggleSocialReaction(postId: string): Promise<boolean> {
  const client = await getClient();
  const { data, error } = await client.rpc('social_toggle_reaction', { p_post_id: postId });
  ensureSuccess(error);
  return Boolean(data);
}

export async function submitSocialReport(input: {
  targetType: SocialReportTarget;
  targetId: string;
  reason: SocialReportReason;
  details: string;
}): Promise<string> {
  const client = await getClient();
  if (input.targetType === 'profile') {
    const { data, error } = await client.rpc('social_submit_profile_report', {
      p_handle: input.targetId,
      p_reason: input.reason,
      p_details: input.details || null
    });
    ensureSuccess(error);
    return data as string;
  }
  const { data, error } = await client.rpc('social_submit_report', {
    p_target_type: input.targetType,
    p_target_id: input.targetId,
    p_reason: input.reason,
    p_details: input.details || null
  });
  ensureSuccess(error);
  return data as string;
}

export async function isSocialModerator(): Promise<boolean> {
  const client = await getClient();
  const { data, error } = await client.rpc('is_social_moderator');
  ensureSuccess(error);
  return Boolean(data);
}

export async function loadSocialModerationQueue(): Promise<SocialModerationQueue> {
  const client = await getClient();
  const [profiles, posts, comments, reports] = await Promise.all([
    client.from('social_profiles').select('user_id, handle, display_name, bio, created_at').eq('status', 'pending').order('created_at').limit(50),
    client.from('social_posts').select('id, author_id, body, created_at').eq('status', 'pending').order('created_at').limit(50),
    client.from('social_comments').select('id, post_id, author_id, body, created_at').eq('status', 'pending').order('created_at').limit(50),
    client.from('social_reports').select('id, reporter_id, target_post_id, target_comment_id, target_profile_user_id, reason, details, created_at').eq('status', 'pending').order('created_at').limit(100)
  ]);
  ensureSuccess(profiles.error || posts.error || comments.error || reports.error);
  return {
    profiles: (profiles.data ?? []) as SocialModerationQueue['profiles'],
    posts: (posts.data ?? []) as SocialModerationQueue['posts'],
    comments: (comments.data ?? []) as SocialModerationQueue['comments'],
    reports: (reports.data ?? []) as SocialModerationQueue['reports']
  };
}

export async function moderateSocialItem(
  type: 'profile' | 'post' | 'comment' | 'report',
  id: string,
  status: 'approved' | 'hidden' | 'resolved' | 'dismissed'
): Promise<void> {
  const client = await getClient();
  const persistedStatus = status === 'hidden' ? 'rejected' : status === 'resolved' ? 'reviewed' : status;
  const rpcName = type === 'profile'
    ? 'moderate_social_profile'
    : type === 'post'
      ? 'moderate_social_post'
      : type === 'comment'
        ? 'moderate_social_comment'
        : 'resolve_social_report';
  const argument = type === 'profile'
    ? { p_user_id: id, p_status: persistedStatus }
    : type === 'post'
      ? { p_post_id: id, p_status: persistedStatus }
      : type === 'comment'
        ? { p_comment_id: id, p_status: persistedStatus }
        : { p_report_id: id, p_status: persistedStatus };
  const { error } = await client.rpc(rpcName, argument);
  ensureSuccess(error);
}
