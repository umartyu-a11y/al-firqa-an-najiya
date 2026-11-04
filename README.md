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


## Player bookmarks and notes

On any lecture page, use `Закладка` to save the current timestamp. Each saved marker can be opened to seek back to that point, annotated with a note up to 500 characters, or removed. Notes are automatically stored in localStorage and remain available offline. Cross-device synchronization for these notes is kept as a separate follow-up Supabase task.


## Exporting notes

The lecture player can export its bookmarks and notes as a UTF-8 `.txt` file. The `PDF` action opens a print-friendly document in a new window; choose “Save as PDF” in the browser or system print dialog. This keeps Cyrillic text readable without embedding a third-party font and works with the current lecture's local notes.


## Full library export

The Library page now exports all locally stored bookmarks and notes from every lecture as one UTF-8 `.txt` file or one print-ready document for “Save as PDF”. Entries include the lecture title, author, timestamp and note text. Empty export buttons remain disabled until at least one bookmark exists.

## Local library backup

The Library page can download a versioned JSON backup of local favorites, listening history and progress, bookmarks/notes, user-created quiz questions and preferences. Restore accepts AL-FIRQA AN-NAJIYA version-1 JSON files up to 5 MiB, validates lecture IDs and record shapes, and merges with existing device data rather than clearing it. Audio files and cloud credentials are never included. Backups are not encrypted and may contain private notes; store the downloaded file securely.


## Library search

“My Library” includes a local search over saved bookmarks and notes. It matches lecture title, author, cycle, timestamp and note text, highlights matching fragments, shows the result count and opens the related lecture from a result.


## Note and bookmark filters

Library search results can be filtered to all records, note-bearing records or plain bookmarks. They can also be sorted by creation date in newest-first or oldest-first order. Each result displays its detected type and creation position context.


## Bookmark tags

Each bookmark can have up to eight comma-separated tags. Tags are normalized, displayed as chips, included in library search and can be selected as a grouping filter. They are also included in TXT/PDF exports.


## Lecture self-tests

Each lecture page includes a local self-test workspace. Users can create questions with two to four answer options, mark the correct option, save the test offline, and later take it in “Пройти” mode. The result is shown after all questions are answered; question sets are stored separately per lecture in localStorage.


## Книги и аудиокурсы

Раздел `#/books` содержит PDF «Разъяснение текста книги “Три основы”» и ссылку на связанный цикл из 18 аудиоуроков. Раздел `#/courses` объединяет этот цикл с уже имеющимся курсом «Необходимые вопросы для каждого» из 111 записей. Уроки показываются и проигрываются по номеру, включая составную нумерацию вроде 103.1–103.3.

PDF и аудио «Три основы» открываются с официальных серверов abuyahya.net; эти файлы не копируются в GitHub-репозиторий. Внешние записи не добавляются в офлайн-кэш приложения.


## Книга единобожия

В каталоге `#/courses` доступен полный цикл «Книга единобожия» из 172 уроков в исполнении Абу Яхья Крымского; на исходную страницу и текст лекций ведёт ссылка на abuyahya.net. MP3 размещены как assets публичного GitHub Release `kitab-edinobozhiya-audio-v1`, а не в Git-истории или сборке GitHub Pages: общий объём 3,314 GiB превышает лимит опубликованного сайта. Записи воспроизводятся онлайн и не попадают в офлайн-кэш service worker.
