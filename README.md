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

## Offline mode

The production build registers `public/sw.js`. It caches the application shell, hashed JavaScript/CSS assets, manifest and the bundled lecture catalog. Navigation uses a network-first strategy with an `index.html` fallback, so previously opened catalog and text routes remain available offline. Audio files and cloud API requests are intentionally not cached; audio playback and Supabase synchronization resume when the connection returns.

## Background audio

The player uses the Media Session API to publish the current lecture to supported mobile browsers and installed PWAs. Lock-screen and headset controls support play/pause, previous/next lecture, ±10-second seeking, direct seek position and stop. Playback remains owned by the root audio element while routes change. Browser support and background playback policies still depend on the device and browser; playback must first be started by a user gesture.


## Cloud playback progress

Listening position is stored in `user_lecture_progress` per user and lecture. During playback it is uploaded at most once every five seconds, and it is flushed immediately on seek, pause and end. The local progress map remains available as an offline fallback and is merged with newer cloud timestamps after authentication.
