# AL-FIRQA AN-NAJIYA

Premium Islamic lecture archive built with React, TypeScript, Vite and Tailwind CSS.

## Supabase library sync

The app keeps working with local storage when Supabase is not configured. To enable cloud synchronization for favorites and listening history:

1. Create a Supabase project.
2. Enable **Anonymous Sign-Ins** under Authentication → Providers.
3. Run [`supabase/migrations/001_user_library_state.sql`](./supabase/migrations/001_user_library_state.sql) in the Supabase SQL editor or through Supabase CLI.
4. Copy `.env.example` to `.env.local` and set the project URL and publishable/anon key:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

Never put a `service_role` key or database password in frontend environment variables. The app uses an anonymous authenticated session and RLS policies restrict each row to its own `auth.uid()`. Without the variables or when Supabase is unavailable, favorites and history remain available through local storage.

The library page supports persistent access through an email magic link. When the current session is anonymous, Supabase upgrades that same identity after email confirmation, so the existing cloud row and its favorites/history keep the same `user_id`. Configure the Supabase Auth email provider and add the deployed site URL to the Auth redirect allow-list.

## Development

```bash
npm install
npm run dev
npm run build
```
