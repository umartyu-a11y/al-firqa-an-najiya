import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AlertTriangle, Heart, MessageCircle, RefreshCw, Send, ShieldCheck, UserRound } from 'lucide-react';
import {
  isSocialModerator,
  loadMySocialProfile,
  loadMySocialReactions,
  loadPublicSocialComments,
  loadPublicSocialFeed,
  loadPublicSocialProfiles,
  loadSocialModerationQueue,
  moderateSocialItem,
  submitSocialComment,
  submitSocialPost,
  submitSocialProfile,
  submitSocialReport,
  toggleSocialReaction
} from './lib/social';
import type { SocialComment, SocialModerationQueue, SocialPost, SocialProfile, SocialPublicProfile, SocialReportReason, SocialReportTarget } from './lib/social';
import { isSupabaseConfigured } from './lib/supabaseConfig';

const reportReasons: Array<{ value: SocialReportReason; label: string }> = [
  { value: 'spam', label: 'Спам или реклама' },
  { value: 'abuse', label: 'Оскорбления или угрозы' },
  { value: 'unverified_religious_claim', label: 'Непроверенное религиозное утверждение или цитата' },
  { value: 'privacy', label: 'Нарушение приватности' },
  { value: 'other', label: 'Другая причина' }
];

const formatSocialDate = (value: string) => new Intl.DateTimeFormat('ru', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const friendlyError = 'Не удалось выполнить действие. Проверьте подключение и попробуйте позже.';

function isConfirmedMember(session: Session | null) {
  const user = session?.user as (Session['user'] & { is_anonymous?: boolean }) | undefined;
  return Boolean(user?.email && user.email_confirmed_at && !user.is_anonymous);
}

function SocialReportForm({
  targetType,
  targetId,
  canWrite,
  onOpenAuth,
  onSubmit
}: {
  targetType: SocialReportTarget;
  targetId: string;
  canWrite: boolean;
  onOpenAuth: () => void;
  onSubmit: (targetType: SocialReportTarget, targetId: string, reason: SocialReportReason, details: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<SocialReportReason>('other');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await onSubmit(targetType, targetId, reason, details.trim());
      setMessage('Жалоба отправлена модераторам.');
      setDetails('');
      setOpen(false);
    } catch {
      setMessage(friendlyError);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return <div className="flex flex-col items-start gap-1"><button type="button" onClick={() => canWrite ? setOpen(true) : onOpenAuth()} className="text-xs text-muted underline underline-offset-4 hover:text-text dark:text-darkmuted dark:hover:text-darktext">Пожаловаться</button>{message && <span role="status" className="text-xs text-muted dark:text-darkmuted">{message}</span>}</div>;

  return (
    <form onSubmit={submit} className="mt-3 space-y-2 rounded-xl border border-black/5 bg-[#F7F9FC] p-3 dark:border-white/10 dark:bg-[#161616]">
      <label className="block text-xs font-medium text-text dark:text-darktext">Причина жалобы
        <select value={reason} onChange={(event) => setReason(event.target.value as SocialReportReason)} className="mt-1 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-text dark:border-white/10 dark:bg-[#101010] dark:text-darktext">
          {reportReasons.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      <label className="block text-xs font-medium text-text dark:text-darktext">Подробности (необязательно)
        <textarea value={details} onChange={(event) => setDetails(event.target.value)} maxLength={500} rows={2} className="mt-1 w-full resize-y rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-text dark:border-white/10 dark:bg-[#101010] dark:text-darktext" />
      </label>
      <div className="flex items-center gap-2"><button disabled={busy} className="rounded-full bg-[#111820] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-[#F5F5F5] dark:text-[#111820]">{busy ? 'Отправка…' : 'Отправить жалобу'}</button><button type="button" onClick={() => setOpen(false)} className="rounded-full border border-black/10 px-3 py-1.5 text-xs text-muted dark:border-white/10 dark:text-darkmuted">Отмена</button></div>
      {message && <p role="status" className="text-xs text-muted dark:text-darkmuted">{message}</p>}
    </form>
  );
}

function SocialCommentRow({
  comment,
  canWrite,
  onOpenAuth,
  onReport
}: {
  comment: SocialComment;
  canWrite: boolean;
  onOpenAuth: () => void;
  onReport: (targetType: SocialReportTarget, targetId: string, reason: SocialReportReason, details: string) => Promise<void>;
}) {
  return (
    <article className="border-t border-black/5 py-3 first:border-t-0 dark:border-white/10">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-sm font-medium text-text dark:text-darktext">{comment.author_name} <span className="font-normal text-muted dark:text-darkmuted">@{comment.author_handle}</span></div><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-text dark:text-darktext">{comment.body}</p><time className="mt-1 block text-[11px] text-muted dark:text-darkmuted">{formatSocialDate(comment.created_at)}</time></div><SocialReportForm targetType="comment" targetId={comment.id} canWrite={canWrite} onOpenAuth={onOpenAuth} onSubmit={onReport} /></div>
    </article>
  );
}

function SocialPublicProfileCard({ profile, canWrite, onOpenAuth, onReport }: {
  profile: SocialPublicProfile;
  canWrite: boolean;
  onOpenAuth: () => void;
  onReport: (targetType: SocialReportTarget, targetId: string, reason: SocialReportReason, details: string) => Promise<void>;
}) {
  return (
    <article className="panel p-4">
      <div className="flex items-start justify-between gap-2"><div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EEF1F4] text-muted dark:bg-[#202020] dark:text-darkmuted"><UserRound size={18} /></div><div className="min-w-0"><h3 className="truncate font-medium text-text dark:text-darktext">{profile.display_name}</h3><p className="text-xs text-muted dark:text-darkmuted">@{profile.handle}</p></div></div><SocialReportForm targetType="profile" targetId={profile.handle} canWrite={canWrite} onOpenAuth={onOpenAuth} onSubmit={onReport} /></div>
      <p className="mt-3 min-h-10 whitespace-pre-wrap break-words text-sm leading-5 text-muted dark:text-darkmuted">{profile.bio || 'Описание не добавлено.'}</p>
      <p className="mt-3 text-[11px] text-muted dark:text-darkmuted">В сообществе с {formatSocialDate(profile.created_at)}</p>
    </article>
  );
}

function SocialPostCard({
  post,
  liked,
  canWrite,
  onOpenAuth,
  onToggleReaction,
  onLoadComments,
  comments,
  commentsOpen,
  onToggleComments,
  onSubmitComment,
  onReport
}: {
  post: SocialPost;
  liked: boolean;
  canWrite: boolean;
  onOpenAuth: () => void;
  onToggleReaction: (id: string) => Promise<void>;
  onLoadComments: (id: string) => Promise<void>;
  comments: SocialComment[];
  commentsOpen: boolean;
  onToggleComments: (id: string) => void;
  onSubmitComment: (postId: string, body: string) => Promise<void>;
  onReport: (targetType: SocialReportTarget, targetId: string, reason: SocialReportReason, details: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentMessage, setCommentMessage] = useState('');
  const [reactionBusy, setReactionBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState('');

  const toggleComments = async () => {
    setActionMessage('');
    try {
      if (!commentsOpen) await onLoadComments(post.id);
      onToggleComments(post.id);
    } catch {
      setActionMessage(friendlyError);
    }
  };

  const submitComment = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    setCommentBusy(true);
    setCommentMessage('');
    try {
      await onSubmitComment(post.id, draft.trim());
      setDraft('');
      setCommentMessage('Комментарий отправлен на проверку. Он появится после одобрения.');
    } catch {
      setCommentMessage(friendlyError);
    } finally {
      setCommentBusy(false);
    }
  };

  const toggleReaction = async () => {
    if (!canWrite) { onOpenAuth(); return; }
    setReactionBusy(true);
    setActionMessage('');
    try { await onToggleReaction(post.id); }
    catch { setActionMessage(friendlyError); }
    finally { setReactionBusy(false); }
  };

  return (
    <article className="panel p-5 sm:p-6">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EEF1F4] text-muted dark:bg-[#202020] dark:text-darkmuted"><UserRound size={18} /></div><div className="min-w-0"><div className="flex flex-wrap items-baseline gap-x-2"><span className="font-medium text-text dark:text-darktext">{post.author_name}</span><span className="text-xs text-muted dark:text-darkmuted">@{post.author_handle}</span></div><time className="mt-0.5 block text-xs text-muted dark:text-darkmuted">{formatSocialDate(post.created_at)}</time></div></div>
      </header>
      <p className="mt-4 whitespace-pre-wrap break-words text-[15px] leading-7 text-text dark:text-darktext">{post.body}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-black/5 pt-3 dark:border-white/10">
        <button type="button" onClick={toggleReaction} disabled={reactionBusy} aria-pressed={liked} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm transition ${liked ? 'bg-[#111820] text-white dark:bg-[#F5F5F5] dark:text-[#111820]' : 'border border-black/5 text-muted hover:bg-black/5 dark:border-white/10 dark:text-darkmuted dark:hover:bg-white/10'}`}><Heart size={15} fill={liked ? 'currentColor' : 'none'} />{post.reaction_count}</button>
        <button type="button" onClick={() => void toggleComments()} className="inline-flex items-center gap-1.5 rounded-full border border-black/5 px-3 py-2 text-sm text-muted hover:bg-black/5 dark:border-white/10 dark:text-darkmuted dark:hover:bg-white/10"><MessageCircle size={15} />{post.comment_count} комментариев</button>
        <SocialReportForm targetType="post" targetId={post.id} canWrite={canWrite} onOpenAuth={onOpenAuth} onSubmit={onReport} />
      </div>
      {actionMessage && <p role="status" className="mt-2 text-xs text-muted dark:text-darkmuted">{actionMessage}</p>}
      {commentsOpen && <section aria-label={`Комментарии к записи ${post.author_name}`} className="mt-4 rounded-2xl bg-[#F7F9FC] px-4 py-1 dark:bg-[#161616]">
        {comments.length ? comments.map((comment) => <SocialCommentRow key={comment.id} comment={comment} canWrite={canWrite} onOpenAuth={onOpenAuth} onReport={onReport} />) : <p className="py-3 text-sm text-muted dark:text-darkmuted">Одобренных комментариев пока нет.</p>}
        {canWrite ? <form onSubmit={submitComment} className="flex items-end gap-2 border-t border-black/5 py-3 dark:border-white/10"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={1000} rows={2} aria-label="Новый комментарий" placeholder="Напишите комментарий…" className="min-w-0 flex-1 resize-y rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-text placeholder:text-muted dark:border-white/10 dark:bg-[#101010] dark:text-darktext dark:placeholder:text-darkmuted" /><button disabled={commentBusy || !draft.trim()} aria-label="Отправить комментарий на проверку" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#111820] text-white disabled:opacity-50 dark:bg-[#F5F5F5] dark:text-[#111820]"><Send size={15} /></button></form> : <div className="border-t border-black/5 py-3 text-xs text-muted dark:border-white/10 dark:text-darkmuted"><button type="button" onClick={onOpenAuth} className="underline underline-offset-4">Войти</button>, чтобы оставить комментарий.</div>}
        {commentMessage && <p role="status" className="pb-3 text-xs text-muted dark:text-darkmuted">{commentMessage}</p>}
      </section>}
    </article>
  );
}

function SocialModerationPanel({
  queue,
  busyId,
  onModerate,
  onRefresh
}: {
  queue: SocialModerationQueue;
  busyId: string;
  onModerate: (type: 'profile' | 'post' | 'comment' | 'report', id: string, status: 'approved' | 'hidden' | 'resolved' | 'dismissed') => Promise<void>;
  onRefresh: () => void;
}) {
  const total = queue.profiles.length + queue.posts.length + queue.comments.length + queue.reports.length;
  const ActionButtons = ({ type, id, report = false }: { type: 'profile' | 'post' | 'comment' | 'report'; id: string; report?: boolean }) => (
    <div className="mt-3 flex flex-wrap gap-2">
      {report ? <><button disabled={busyId === id} onClick={() => void onModerate(type, id, 'resolved')} className="rounded-full bg-[#111820] px-3 py-1.5 text-xs text-white disabled:opacity-50 dark:bg-[#F5F5F5] dark:text-[#111820]">Рассмотрена</button><button disabled={busyId === id} onClick={() => void onModerate(type, id, 'dismissed')} className="rounded-full border border-black/10 px-3 py-1.5 text-xs text-muted disabled:opacity-50 dark:border-white/10 dark:text-darkmuted">Отклонить жалобу</button></> : <><button disabled={busyId === id} onClick={() => void onModerate(type, id, 'approved')} className="rounded-full bg-[#111820] px-3 py-1.5 text-xs text-white disabled:opacity-50 dark:bg-[#F5F5F5] dark:text-[#111820]">Одобрить</button><button disabled={busyId === id} onClick={() => void onModerate(type, id, 'hidden')} className="rounded-full border border-black/10 px-3 py-1.5 text-xs text-muted disabled:opacity-50 dark:border-white/10 dark:text-darkmuted">Скрыть</button></>}
    </div>
  );
  return (
    <section className="panel border-[#B8874A]/30 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.14em] text-muted dark:text-darkmuted">Только модераторам</p><h2 className="mt-1 font-display text-2xl text-text dark:text-darktext">Очередь проверки <span className="text-base text-muted dark:text-darkmuted">{total}</span></h2></div><button type="button" onClick={onRefresh} aria-label="Обновить очередь модерации" className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-muted dark:border-white/10 dark:text-darkmuted"><RefreshCw size={15} /></button></div>
      {total === 0 ? <p className="mt-4 text-sm text-muted dark:text-darkmuted">Новых записей и жалоб нет.</p> : <div className="mt-4 space-y-3">
        {queue.profiles.map((profile) => <article key={`profile-${profile.user_id}`} className="rounded-2xl bg-[#F7F9FC] p-4 dark:bg-[#161616]"><p className="text-xs uppercase tracking-wide text-muted dark:text-darkmuted">Профиль @{profile.handle}</p><h3 className="mt-1 font-medium text-text dark:text-darktext">{profile.display_name}</h3>{profile.bio && <p className="mt-1 text-sm text-text dark:text-darktext">{profile.bio}</p>}<ActionButtons type="profile" id={profile.user_id} /></article>)}
        {queue.posts.map((post) => <article key={`post-${post.id}`} className="rounded-2xl bg-[#F7F9FC] p-4 dark:bg-[#161616]"><p className="text-xs uppercase tracking-wide text-muted dark:text-darkmuted">Публикация</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text dark:text-darktext">{post.body}</p><ActionButtons type="post" id={post.id} /></article>)}
        {queue.comments.map((comment) => <article key={`comment-${comment.id}`} className="rounded-2xl bg-[#F7F9FC] p-4 dark:bg-[#161616]"><p className="text-xs uppercase tracking-wide text-muted dark:text-darkmuted">Комментарий</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text dark:text-darktext">{comment.body}</p><ActionButtons type="comment" id={comment.id} /></article>)}
        {queue.reports.map((report) => <article key={`report-${report.id}`} className="rounded-2xl border border-[#B8874A]/20 bg-[#F7F9FC] p-4 dark:bg-[#161616]"><p className="text-xs uppercase tracking-wide text-muted dark:text-darkmuted">Жалоба · {report.reason}</p><p className="mt-2 text-sm text-text dark:text-darktext">Объект: {report.target_post_id ? 'публикация' : report.target_comment_id ? 'комментарий' : 'профиль'} · {report.target_post_id ?? report.target_comment_id ?? report.target_profile_user_id}</p>{report.details && <p className="mt-1 text-sm text-muted dark:text-darkmuted">{report.details}</p>}<ActionButtons type="report" id={report.id} report /></article>)}
      </div>}
    </section>
  );
}

export function SocialPage({ session, onOpenAuth, onOpenCatalog }: { session: Session | null; onOpenAuth: () => void; onOpenCatalog: () => void }) {
  const member = isConfirmedMember(session);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [publicProfiles, setPublicProfiles] = useState<SocialPublicProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedUnavailable, setFeedUnavailable] = useState(false);
  const [feedRefresh, setFeedRefresh] = useState(0);
  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [profileForm, setProfileForm] = useState({ handle: '', displayName: '', bio: '' });
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [postBody, setPostBody] = useState('');
  const [postBusy, setPostBusy] = useState(false);
  const [postMessage, setPostMessage] = useState('');
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const [commentsOpenId, setCommentsOpenId] = useState<string | null>(null);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, SocialComment[]>>({});
  const [isModerator, setIsModerator] = useState(false);
  const [moderationQueue, setModerationQueue] = useState<SocialModerationQueue>({ profiles: [], posts: [], comments: [], reports: [] });
  const [moderationBusyId, setModerationBusyId] = useState('');
  const [pageMessage, setPageMessage] = useState('');

  const refreshFeed = useCallback(() => setFeedRefresh((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured) { setLoading(false); setFeedUnavailable(true); return () => { active = false; }; }
    setLoading(true);
    Promise.all([loadPublicSocialFeed(), loadPublicSocialProfiles()]).then(([data, profiles]) => {
      if (active) { setPosts(data); setPublicProfiles(profiles); setFeedUnavailable(false); }
    }).catch(() => { if (active) setFeedUnavailable(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [feedRefresh]);

  useEffect(() => {
    let active = true;
    setProfile(null);
    setLikedIds([]);
    setIsModerator(false);
    if (!member || !session?.user.id || !isSupabaseConfigured) return () => { active = false; };
    Promise.all([loadMySocialProfile(session.user.id), loadMySocialReactions(session.user.id), isSocialModerator()]).then(([myProfile, reactions, moderator]) => {
      if (!active) return;
      setProfile(myProfile);
      setProfileForm({ handle: myProfile?.handle ?? '', displayName: myProfile?.display_name ?? '', bio: myProfile?.bio ?? '' });
      setEditingProfile(!myProfile || myProfile.status !== 'approved');
      setLikedIds(reactions);
      setIsModerator(moderator);
    }).catch(() => { if (active) setPageMessage('Не удалось загрузить данные профиля.'); });
    return () => { active = false; };
  }, [member, session?.user.id]);

  useEffect(() => {
    let active = true;
    if (!isModerator) return () => { active = false; };
    loadSocialModerationQueue().then((queue) => { if (active) setModerationQueue(queue); }).catch(() => { if (active) setPageMessage('Очередь модерации пока недоступна.'); });
    return () => { active = false; };
  }, [isModerator, feedRefresh]);

  const report = async (targetType: SocialReportTarget, targetId: string, reason: SocialReportReason, details: string) => {
    if (!member) throw new Error('AUTH_REQUIRED');
    await submitSocialReport({ targetType, targetId, reason, details });
  };

  const submitProfile = async (event: FormEvent) => {
    event.preventDefault();
    setProfileBusy(true);
    setProfileMessage('');
    try {
      const saved = await submitSocialProfile({ handle: profileForm.handle.trim().toLowerCase(), displayName: profileForm.displayName.trim(), bio: profileForm.bio.trim() });
      setProfile(saved);
      setEditingProfile(false);
      setProfileMessage('Профиль отправлен на проверку. Он станет публичным после одобрения модератором.');
    } catch {
      setProfileMessage('Не удалось сохранить профиль. Проверьте псевдоним и попробуйте ещё раз.');
    } finally { setProfileBusy(false); }
  };

  const publishPost = async (event: FormEvent) => {
    event.preventDefault();
    if (!postBody.trim()) return;
    setPostBusy(true);
    setPostMessage('');
    try {
      await submitSocialPost(postBody.trim());
      setPostBody('');
      setPostMessage('Публикация отправлена на проверку. Она появится в общей ленте после одобрения.');
      refreshFeed();
    } catch {
      setPostMessage(friendlyError);
    } finally { setPostBusy(false); }
  };

  const toggleLike = async (postId: string) => {
    if (!member) { onOpenAuth(); return; }
    const added = await toggleSocialReaction(postId);
    setLikedIds((current) => added ? [...new Set([...current, postId])] : current.filter((id) => id !== postId));
    setPosts((current) => current.map((post) => post.id === postId ? { ...post, reaction_count: Math.max(0, post.reaction_count + (added ? 1 : -1)) } : post));
  };

  const loadComments = async (postId: string) => {
    const data = await loadPublicSocialComments(postId);
    setCommentsByPost((current) => ({ ...current, [postId]: data }));
  };

  const submitComment = async (postId: string, body: string) => {
    if (!member) throw new Error('AUTH_REQUIRED');
    await submitSocialComment(postId, body);
  };

  const moderate = async (type: 'profile' | 'post' | 'comment' | 'report', id: string, status: 'approved' | 'hidden' | 'resolved' | 'dismissed') => {
    setModerationBusyId(id);
    setPageMessage('');
    try {
      await moderateSocialItem(type, id, status);
      setPageMessage('Решение модерации сохранено.');
      refreshFeed();
    } catch {
      setPageMessage('Не удалось сохранить решение. Проверьте права модератора.');
    } finally { setModerationBusyId(''); }
  };

  const refreshModeration = async () => {
    try { setModerationQueue(await loadSocialModerationQueue()); setPageMessage('Очередь обновлена.'); }
    catch { setPageMessage('Не удалось обновить очередь.'); }
  };

  return (
    <main className="mx-auto max-w-[980px] space-y-6">
      <header className="panel p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.16em] text-muted dark:text-darkmuted">Общение слушателей</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4"><div><h1 className="font-display text-4xl tracking-[-0.04em] text-text dark:text-darktext">Сообщество</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted dark:text-darkmuted">Обсуждайте уроки и делитесь вопросами. Публикации участников — пользовательский контент, а не проверенные материалы архива.</p></div><button type="button" onClick={refreshFeed} className="inline-flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-sm text-muted hover:bg-black/5 dark:border-white/10 dark:text-darkmuted dark:hover:bg-white/10"><RefreshCw size={15} />Обновить</button></div>
        <div className="mt-4 flex gap-3 rounded-2xl border border-[#B8874A]/20 bg-[#F7F9FC] p-4 text-xs leading-5 text-muted dark:border-white/10 dark:bg-[#161616] dark:text-darkmuted"><ShieldCheck size={17} className="mt-0.5 shrink-0" /><p>Профили, публикации и комментарии становятся видны всем только после проверки модератором. Email и данные входа публично не показываются. Жалобы доступны модераторам и автору жалобы.</p></div>
      </header>

      {!isSupabaseConfigured ? <section className="panel p-6 sm:p-8"><div className="flex items-start gap-3"><AlertTriangle size={20} className="mt-0.5 shrink-0 text-[#B8874A]" /><div><h2 className="font-display text-2xl text-text dark:text-darktext">Общая лента пока не подключена</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted dark:text-darkmuted">Для настоящих публикаций нужно настроить владельческий Supabase, подтвердить Auth callbacks и включить проверенную RLS-схему. Примерных записей здесь нет; до безопасного подключения эта страница не собирает и не передаёт данные.</p><button type="button" onClick={onOpenCatalog} className="mt-5 rounded-full bg-[#111820] px-4 py-2.5 text-sm text-white dark:bg-[#F5F5F5] dark:text-[#111820]">Найти лекцию</button></div></div></section> : <>
        {feedUnavailable && <div role="status" className="panel p-5 text-sm text-muted dark:text-darkmuted">Лента временно недоступна. Проверьте подключение сервиса и его RLS-настройки.</div>}
        {member ? <section className="panel p-5 sm:p-6">
          <div className="flex items-center gap-2"><UserRound size={17} className="text-muted dark:text-darkmuted" /><h2 className="font-display text-2xl text-text dark:text-darktext">Ваш профиль сообщества</h2></div>
          {profile?.status === 'approved' && !editingProfile ? <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#F7F9FC] p-4 dark:bg-[#161616]"><div><div className="font-medium text-text dark:text-darktext">{profile.display_name} <span className="text-sm font-normal text-muted dark:text-darkmuted">@{profile.handle}</span></div><p className="mt-1 text-sm text-muted dark:text-darkmuted">{profile.bio || 'Описание не добавлено.'}</p></div><button type="button" onClick={() => { setEditingProfile(true); setProfileMessage('При изменении профиль снова проходит проверку и временно скрывается.'); }} className="rounded-full border border-black/10 px-3 py-2 text-xs text-muted dark:border-white/10 dark:text-darkmuted">Изменить профиль</button></div> : <>
            {profile?.status === 'pending' && <p className="mt-3 rounded-xl bg-[#F7F9FC] p-3 text-sm text-muted dark:bg-[#161616] dark:text-darkmuted">Профиль ожидает проверки. После одобрения можно будет публиковать записи.</p>}
            {profile?.status === 'rejected' && <p className="mt-3 rounded-xl bg-[#F7F9FC] p-3 text-sm text-muted dark:bg-[#161616] dark:text-darkmuted">Профиль скрыт модератором. Свяжитесь с командой сайта, если считаете это ошибкой.</p>}
            {editingProfile && <form onSubmit={submitProfile} className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-text dark:text-darktext">Псевдоним (3–24 латинских букв, цифр или _)<input required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" autoComplete="nickname" value={profileForm.handle} onChange={(event) => setProfileForm((prev) => ({ ...prev, handle: event.target.value }))} className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-[#101010] dark:text-darktext" /></label>
              <label className="text-xs font-medium text-text dark:text-darktext">Отображаемое имя<input required minLength={2} maxLength={40} autoComplete="name" value={profileForm.displayName} onChange={(event) => setProfileForm((prev) => ({ ...prev, displayName: event.target.value }))} className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-[#101010] dark:text-darktext" /></label>
              <label className="text-xs font-medium text-text dark:text-darktext sm:col-span-2">Короткое описание (необязательно)<textarea maxLength={280} rows={2} value={profileForm.bio} onChange={(event) => setProfileForm((prev) => ({ ...prev, bio: event.target.value }))} className="mt-1 w-full resize-y rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-[#101010] dark:text-darktext" /></label>
              <div className="sm:col-span-2"><button disabled={profileBusy} className="rounded-full bg-[#111820] px-4 py-2.5 text-sm text-white disabled:opacity-50 dark:bg-[#F5F5F5] dark:text-[#111820]">{profileBusy ? 'Отправка…' : 'Отправить профиль на проверку'}</button></div>
            </form>}
          </>}
          {profileMessage && <p role="status" className="mt-3 text-sm text-muted dark:text-darkmuted">{profileMessage}</p>}
        </section> : <section className="panel flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6"><div><h2 className="font-display text-2xl text-text dark:text-darktext">Хотите участвовать?</h2><p className="mt-1 text-sm text-muted dark:text-darkmuted">Вход по подтверждённому email нужен для профиля и защиты от злоупотреблений. Ваш email не появится в профиле.</p></div><button type="button" onClick={onOpenAuth} className="rounded-full bg-[#111820] px-4 py-2.5 text-sm text-white dark:bg-[#F5F5F5] dark:text-[#111820]">Войти по email</button></section>}

        {member && profile?.status === 'approved' && <form onSubmit={publishPost} className="panel p-5 sm:p-6"><label htmlFor="social-post-body" className="font-display text-2xl text-text dark:text-darktext">Новая публикация</label><textarea id="social-post-body" value={postBody} onChange={(event) => setPostBody(event.target.value)} maxLength={2000} rows={4} placeholder="Поделитесь вопросом или мыслью по уроку…" className="mt-3 w-full resize-y rounded-2xl border border-black/10 bg-[#F7F9FC] px-4 py-3 text-sm leading-6 text-text placeholder:text-muted dark:border-white/10 dark:bg-[#161616] dark:text-darktext dark:placeholder:text-darkmuted" /><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted dark:text-darkmuted">До 2 000 знаков · сначала проверка модератором · {postBody.length}/2000</p><button disabled={postBusy || !postBody.trim()} className="inline-flex items-center gap-2 rounded-full bg-[#111820] px-4 py-2.5 text-sm text-white disabled:opacity-50 dark:bg-[#F5F5F5] dark:text-[#111820]"><Send size={15} />{postBusy ? 'Отправка…' : 'Отправить на проверку'}</button></div>{postMessage && <p role="status" className="mt-3 text-sm text-muted dark:text-darkmuted">{postMessage}</p>}</form>}

        {isModerator && <SocialModerationPanel queue={moderationQueue} busyId={moderationBusyId} onModerate={moderate} onRefresh={() => void refreshModeration()} />}

        {!feedUnavailable && <section className="space-y-4" aria-label="Публичные профили участников"><div className="flex items-center justify-between"><h2 className="font-display text-2xl text-text dark:text-darktext">Профили сообщества</h2><span className="text-xs text-muted dark:text-darkmuted">{publicProfiles.length}</span></div>{publicProfiles.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{publicProfiles.map((publicProfile) => <SocialPublicProfileCard key={publicProfile.handle} profile={publicProfile} canWrite={member} onOpenAuth={onOpenAuth} onReport={report} />)}</div> : <div className="panel p-5 text-sm text-muted dark:text-darkmuted">Публичных профилей пока нет. Они появятся после проверки новых участников.</div>}</section>}

        <section className="space-y-4" aria-label="Публичная лента">
          <div className="flex items-center justify-between"><h2 className="font-display text-2xl text-text dark:text-darktext">Публичная лента</h2>{loading && <span className="text-xs text-muted dark:text-darkmuted">Загрузка…</span>}</div>
          {loading ? <div className="panel p-6 text-sm text-muted dark:text-darkmuted">Загружаем одобренные публикации…</div> : feedUnavailable ? null : posts.length === 0 ? <div className="panel p-6"><h3 className="font-medium text-text dark:text-darktext">Пока нет одобренных публикаций</h3><p className="mt-1 text-sm text-muted dark:text-darkmuted">Новые записи появятся здесь после проверки модератором.</p></div> : posts.map((post) => <SocialPostCard key={post.id} post={post} liked={likedIds.includes(post.id)} canWrite={member} onOpenAuth={onOpenAuth} onToggleReaction={toggleLike} onLoadComments={loadComments} comments={commentsByPost[post.id] ?? []} commentsOpen={commentsOpenId === post.id} onToggleComments={(id) => setCommentsOpenId((current) => current === id ? null : id)} onSubmitComment={submitComment} onReport={report} />)}
        </section>
      </>}
      {pageMessage && <div role="status" className="rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm text-muted dark:border-white/10 dark:bg-[#101010] dark:text-darkmuted">{pageMessage}</div>}
      <p className="px-1 text-xs leading-5 text-muted dark:text-darkmuted">Материалы сообщества публикуются под ответственностью их авторов и не заменяют лекции и редакционно проверенные тексты архива.</p>
    </main>
  );
}
