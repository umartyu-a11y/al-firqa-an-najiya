# AL-FIRQA AN-NAJIYA — Maximum Evolution outcomes

## Stage 1 — reliable foundation
- [x] Opening a direct `#/lecture/<id>` URL, including page load and hash navigation to another lecture, keeps the displayed lecture and selected audio track in sync; opening a URL does not start audio without the user’s action.
- [x] The PWA manifest is linked from the document with the correct GitHub Pages base path and the existing icon/scope remain valid.
- [x] The public route manifest lists all 13 existing static/dynamic hash routes and stays synchronized with the current router.
- [x] Git excludes local `.env.local`/secret-bearing env files while retaining the placeholder `.env.example`; no service-role key is placed in browser code.
- [x] Lecture cards are keyboard operable through semantic title/open controls and have localized favorite names; player ranges have labels; the auth dialog traps/restores focus and supports Escape dismissal.
- [x] Preserve existing routes, lecture data, external sources, themes, and player/library features while applying these fixes.

## 1. Advanced Lecture Library
- [x] Preserve the existing 111-lesson and 18-lesson collections, cycle order, metadata filters, sorting, and source links.
- [x] Search the currently indexed lecture metadata and local library notes/bookmarks without a server dependency.
- [x] Filter the lecture list by its verified course/cycle and clear the query, filters and sort; result counts and search scope are announced accessibly.
- [ ] Provide a unified, keyboard-operable catalogue with filters and results across lecture, author, book, course, verified note and verified transcript entities.
- [ ] Search the actual full text of notes/transcripts only after those materials exist and have a review status/source; do not imply that metadata search is full-text search.
- [ ] Keep each result linked to its source and related materials and distinguish drafts from published content.

## 2. Lecture Notes System
- [ ] Every lecture can have a short summary and a structured detailed outline, key points, terms, referenced evidence, original Arabic where verified, Russian translation where verified, editor notes, conclusions, and linked materials.
- [ ] Each note section records source/provenance, editorial status, reviewer and revision date; unsupported religious evidence, quotations, translations, attribution, or lecture statements are not invented or published.
- [ ] Unavailable notes show an honest not-yet-published state rather than fabricated content.

## 3. Advanced Audio Player
- [x] Retain the single global audio element, Media Session integration, speed control, sleep timer, seek, position persistence, A–B repeat, repeat lesson, previous/next controls, and ordered cycle playback.
- [x] Retain restoration after reload without autoplay, side-swipe track navigation, and the collapsible mini-player.
- [ ] Keep audio loading on demand, provide clear loading/error states and retry, and do not download full recordings merely to render metadata.
- [ ] Verify lock-screen/headset controls, keyboard access and responsive controls on iPhone/iPad and desktop without regressing current playback.

## 4. Personal Dashboard
- [x] Preserve the current local My Library area with favorites, history, continued listening, local bookmarks/notes, exports, and search.
- [x] Export and restore a versioned local JSON backup for favorites, history, playback progress, notes/bookmarks, user-created quizzes and preferences; import is validated and merges without deleting existing local records.
- [x] Warn that JSON backups contain unencrypted private notes; cap imports at 5 MiB and omit audio binaries and cloud credentials.
- [ ] Present a privacy-respecting user dashboard with learning overview, recent activity, saved resources and clear local-only/cloud-sync status.
- [ ] Never show invented study statistics; derive them only from saved, available learning records.

## 5. Learning Progress
- [x] Store local per-lecture playback position and show progress for available lessons/cycles.
- [x] Keep a Supabase sync adapter for playback progress when a configured backend and safe row-level policies are available; deployment configuration is not assumed.
- [ ] Add explicit lesson completion and course-level learning progress only from real user actions, with accessible reset/export controls.

## 6. Islamic Book Library
- [x] Preserve the existing verified «Три основы» PDF link and its related 18-lesson audio course.
- [ ] Present books with source, author, edition/translation, rights status and available formats.
- [ ] Add reading/reader progress and book bookmarks only for supplied or authorized book files; never imply the site owns third-party material without evidence.

## 7. Full-text Search
- [x] Preserve the existing local search over lecture metadata and saved note/bookmark text.
- [ ] Search full text across published lecture notes, transcripts, books and knowledge entries when the actual indexed text and publication permission are available.
- [ ] Show source/entity type and direct navigation; never treat absent text as a match or fabricate snippets.

## 8. Knowledge Center
- [ ] Link published authors, books, cycles, lessons, notes, verified Arabic terms, citations and related materials through explicit reviewed relations.
- [ ] Every religious term/evidence entry includes a checkable primary source and editorial review; unknown links remain absent rather than guessed.

## 9. Quiz & Examination System
- [x] Preserve local self-tests that users create separately for each lecture, take offline and review after answering.
- [ ] Support structured quizzes and examinations with saved attempts, score/review, retry and links to source lessons; published answer keys must have an editor/source.
- [ ] Keep quiz results local unless secure authenticated storage and RLS are configured; prevent users from changing other users’ records.

## 10. Bookmarks & Notes
- [x] Preserve local time-based lecture bookmarks, user annotations, up to eight tags, search, TXT/PDF export and deletion.
- [x] Include local bookmarks/notes in the validated JSON backup and merge-import path.
- [ ] Provide consistent bookmark/note management for lecture and authorized book content, with export/backup and safe deletion.
- [ ] Synchronize private annotations only after an authenticated, per-user backend schema and conflict behavior are configured.

## 11. Offline Mode
- [x] Preserve the current service-worker app-shell/static-asset offline fallback; keep private API responses and third-party audio out of the public cache.
- [x] Link and verify the PWA manifest path and start URL for the GitHub Pages subpath.
- [ ] Manage service-worker version updates without losing saved local data.
- [ ] Offer offline books/audio only when publication rights are confirmed and the user can see storage size, download progress, failure state and remove the saved copy.

## 12. Cross-device Synchronization
- [x] Preserve local-first behavior and existing code adapters for cloud favorites/history and playback progress when Supabase is configured.
- [ ] Verify the actual Supabase project, email auth callback, redirect allow-list and RLS before enabling sync in production.
- [ ] Sync progress, bookmarks, notes and quiz attempts only with per-user RLS, documented conflict resolution, offline fallback, export/backup and account-data deletion.
- [ ] No `service_role`/database secret is exposed to the browser; the anonymous client key is used only with verified policies.

## 13. Admin CMS
- [ ] Add an administration CMS only after a backend and trusted role model exist; authorization is enforced server-side, not by a hidden client route.
- [ ] Support draft → editorial review → published states, content/source provenance, version history and auditable publication changes.
- [ ] A CMS cannot publish unverified religious evidence, copied notes, translations or third-party files without source and review.

## 14. PWA
- [x] Preserve the existing service-worker shell, manifest file, standalone display settings and app icons.
- [x] Link the manifest in HTML using the correct deployment base and verify installation scope/start URL for the GitHub Pages subpath.
- [ ] Preserve fast route loads and static fallback; keep authentication/private data outside public caches.

## 15. Accessibility
- [x] Preserve current light/dark theme, visible focus styling, reduced-motion support and mobile navigation.
- [x] Name the lecture-card and player range controls, use semantic lecture actions, and give the auth dialog predictable focus restoration/Escape behavior.
- [x] Test 13 existing routes at 768×1024 and 390×844; no horizontal overflow or page errors, and tablet/mobile navigation remains visible.
- [ ] Complete keyboard operation and localized names for remaining controls, forms and dialogs.
- [ ] Verify desktop, zoom, screen-reader and reduced-motion behavior in addition to the checked iPhone/iPad widths.
- [ ] Validate representative screen-reader and keyboard flows before describing the site as fully accessible.

## Existing project outcomes — keep intact

### Downloadable full-cycle ZIP archives
- [x] Both cycle pages provide direct links to public ZIPs with every MP3 in their respective cycle.
- [x] The «Три основы» ZIP contains 18 tracks; «Необходимые вопросы для каждого» contains 111 tracks.
- [x] Filenames preserve cycle identity and lesson order; each archive includes a manifest.

### Home page organized around books and cycles
- [x] The home page shows cycles grouped by verified book associations rather than individual lecture cards.
- [x] Audio cycles without a registered book remain available separately; book associations are not invented.

### Playback and mini-player behavior
- [x] On natural end, the next lesson in the ordered current cycle starts; repeat lesson takes priority and the final lesson does not wrap.
- [x] Save the current lecture and position locally and restore after metadata without automatic playback.
- [x] Hide the mini-player with a downward swipe without stopping audio; restore it with a visible arrow.
- [x] Swipe left to the next track and right to the previous track; controls/sliders/selectors keep their own gestures.

### Books and courses
- [x] Preserve the published «Три основы» PDF/audio source and 18 ordered lessons.
- [x] Preserve «Необходимые вопросы для каждого» and all 111 ordered recordings, including composite lesson numbers.

### Lecture self-tests
- [x] Keep locally created per-lecture question sets, answer selection, scoring after all answers and offline storage.
- [ ] Cross-device test synchronization is included in the Cross-device Synchronization criteria above.
