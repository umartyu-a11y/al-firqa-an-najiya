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
- [x] The reusable lecture-note model and view support a short summary, structured outline, key points, terms, referenced evidence, verified Arabic text, attributed Russian translation, editor notes, conclusions, and related materials.
- [x] Sections link to their audio timestamp and relevant evidence; each note records provenance, editorial status, reviewer field and revision date. Unverified claims and working hadith translations are explicitly qualified rather than presented as established publication.
- [x] Unavailable notes show an honest not-yet-published state rather than fabricated content.
- [x] Lesson 1 of «Необходимые вопросы для каждого» now has a sourced draft. It is visibly marked as awaiting review; no note content was fabricated for other lessons.
- [ ] Complete human scholarly/editorial review of Lesson 1 and verify the transcript wording/timestamps against the recording before changing its status to reviewed.

## 3. Advanced Audio Player
- [x] Retain the single global audio element, Media Session integration, speed control, sleep timer, seek, position persistence, A–B repeat, repeat lesson, previous/next controls, and ordered cycle playback.
- [x] Retain restoration after reload without autoplay, side-swipe track navigation, and the collapsible mini-player.
- [ ] Keep audio loading on demand, provide clear loading/error states and retry, and do not download full recordings merely to render metadata.
- [ ] Verify lock-screen/headset controls, keyboard access and responsive controls on iPhone/iPad and desktop without regressing current playback.

## 4. Personal Dashboard
- [x] Preserve the current local My Library area with favorites, history, continued listening, local bookmarks/notes, exports, and search.
- [x] Export and restore a versioned local JSON backup for favorites, history, playback progress, notes/bookmarks, user-created quizzes and preferences; import is validated and merges without deleting existing local records.
- [x] Warn that JSON backups contain unencrypted private notes; cap imports at 5 MiB and omit audio binaries and cloud credentials.
- [x] Present a privacy-respecting user dashboard with learning overview, recent activity, saved resources and clear local-only/cloud-sync status.
- [x] Never show invented study statistics; derive them only from saved, available learning records. The overview counts saved playback positions and never labels a lesson completed without an explicit completion action.

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

## 16. Knowledge Map — первый локальный этап
- [x] Создать отдельную интерактивную карту только на основе текущих записей книг, циклов, уроков и существующего конспекта; связывать книгу и цикл только по явному `cycleId`, цикл и урок — по `cycleId`, урок и конспект — по `lectureId`, конспект и термин/источник — только по уже существующим идентификаторам и ссылкам.
- [x] Показывать для каждого узла тип, название, доступный источник и фактический редакционный статус; текущий конспект урока 1 остаётся помеченным как черновик, а цитируемые им сведения не представляются как независимо проверенные.
- [x] Фильтровать и искать только по реально имеющимся названиям и метаданным; связывать уроки с темами лишь по имеющимся категориям/тегам; не придумывать главы или доказательства при отсутствии исходной записи.
- [x] Открывать существующие маршруты уроков/циклов и указанные источники; сохранить hash-router, GitHub Pages base path, темы, единый аудиоплеер и локальные данные.
- [x] Реализовать этап без новых backend-таблиц, cloud sync, секретов и изменения production-развёртывания.

## 17. Smart Transcript
- [ ] Publish complete transcripts only from supplied or otherwise verified recordings; split them into meaningful chapters with timestamps, audio seek links and transcript search.
- [ ] Provide an editor workflow for corrections and preserve the transcript source, revision history and review status; do not treat automated speech recognition as a verified transcript.

## 18. Research Center and source provenance
- [ ] Add structured Quran, hadith, bibliography, Arabic-primary-source and Russian-translation records only with checkable attribution, publication/source links and editorial review status.
- [ ] Link citations to actual lecture/note fragments and term entries; retain revision history and distinguish quoted, paraphrased, weak/uncertain and not-yet-reviewed material without inventing evidence.

## 19. Smart Learning
- [ ] Add spaced repetition, term flashcards, examinations/randomized questions, daily goals, study calendar and individual plans; published answer keys must link to reviewed source material.
- [ ] Derive progress/statistics only from real user actions; preserve local/offline self-tests and provide reset/export controls before any cross-device sync.

## 20. AI Library Assistant
- [ ] Answer only from the available reviewed library; show citations and source quotations, link answers to specific lesson/audio timestamps, and clearly abstain when the archive has no answer.
- [ ] Do not fabricate evidence or present generated responses as religious fatwas; do not deploy the assistant until its source-index, privacy, backend and abuse controls are reviewed.

## 21. Deep Study Mode for iPad
- [ ] Provide a focused study layout combining the player with a synchronized reviewed transcript, notes, bookmarks and linked evidence; preserve direct seek-to-fragment behavior.
- [ ] Support adjustable reading size and full-screen reading with keyboard, touch, RTL Arabic, reduced-motion and screen-reader access.

## 22. Personal Knowledge Management
- [ ] Add personal collections, study journal, study history, note export, saved timestamp fragments and curated personal lists without inventing study activity.
- [ ] Keep private data local by default; document backup/encryption and require per-user RLS and conflict behavior before cross-device sync.

## 23. Content Quality Control and publishing
- [ ] Provide editorial correction, citation checking, error reporting, revision history, moderation of user reports and explicit draft/reviewed/published states.
- [ ] Enable editors/admins only through a trusted server-side role model and auditable backend; public release of religious content requires source attribution and an identified review action.

## 24. Premium UX, accessibility and offline
- [ ] Refine typography, light/dark modes, transitions, search speed, Arabic/RTL handling and responsive phone/iPad/desktop navigation while preserving current visual identity and features.
- [ ] Validate keyboard, zoom, screen-reader, reduced-motion and device layouts; publish only checked accessibility claims.
- [ ] Maintain free access; manage PWA version updates without losing user data, and offer offline books/audio only when rights are confirmed and storage size, download progress, errors and removal are user-controlled.


## 25. Книга единобожия — полный аудиокурс
- [x] Добавить все 172 нумерованные аудиозаписи исходной страницы в каталог «Книга единобожия», с последовательной навигацией, общим плеером, верной длительностью и атрибуцией Абу Яхья Крымскому.
- [x] Публично разместить копии записей в GitHub Release, не добавляя 3,3 GiB MP3 в Git-историю или сборку GitHub Pages; привязать страницу курса к Release assets и сохранить ссылку на исходную страницу.
- [x] После проверки сборки и воспроизведения опубликовать каталог и страницу курса на GitHub Pages; не включать внешние MP3 в офлайн-кэш приложения.
- [x] Для iOS-совместимого встроенного проигрывания использовать исходный `audio/mpeg`-поток, а GitHub Release оставить резервным источником с автоматическим fallback при ошибке.

## 26. Рукописные заметки в закладках
- [x] В заметке каждой закладки дать возможность рисовать пальцем или стилусом, не мешая обычному тексту и тегам; обеспечить отмену последнего штриха и очистку рисунка.
- [x] Сохранять рисунок локально вместе с закладкой; восстанавливать его при повторном открытии и включать в экспортируемую резервную копию/импорт.
- [x] Считать закладку с рисунком заметкой в фильтре библиотеки и показывать, что у неё есть рукописное содержимое.

## 27. Точность пера и расширяемые заметки
- [x] Рисовать штрих точно под точкой касания пальца или пера на разных размерах и ориентациях экрана.
- [x] Дать выбрать толщину каждого нового штриха от 1 мм до 10 мм.
- [x] Автоматически расширять текстовое поле заметки по мере ввода; длинное содержимое ограничивать высотой экрана и прокручивать внутри поля.

## 28. Исходные тексты курсов
- [x] Импортировать все текстовые разделы уроков «Книги единобожия» (№1–172) и «Трёх основ» (№1–18) с официальных страниц, показывая их рядом с соответствующими аудиоуроками. Урок №21 «Книги единобожия» содержит только заголовок в первоисточнике, поэтому не дополнять отсутствующий текст.
- [x] Сохранять первоисточник и атрибуцию; явно отличать текст страницы источника от редакционно проверенных конспектов проекта.
- [x] Разместить разрешённый PDF «Трёх основ» в локальной библиотеке и проверить ссылки, сборку и размер GitHub Pages.

## 29. Вход в архив с главной страницы
- [x] Представить сайт как более широкий архив лекций и учебных материалов, а не только как «Циклы по книгам».
- [x] Добавить на главную блок «Начните здесь» с прямыми ссылками на поиск лекций, каталог учебных циклов и библиотеку книг.

## 30. Полезные пустые состояния ресурсов
- [x] В личной библиотеке объяснить, как начать прослушивание, сохранить избранное и создать заметку/закладку; дать прямой переход к каталогу лекций.
- [x] При пустой выдаче поиска по сохранённым заметкам и закладкам объяснить, что можно изменить, и предоставить сброс запроса и фильтров.
- [x] На странице «Тексты» указать, что опубликованные тексты доступны на страницах уроков, и направить к учебным циклам; отсутствие блока в первоисточнике не заполнять самостоятельно.
- [x] На странице «Словарь» честно обозначить отсутствие отдельного проверенного словаря и направить к уже связанным терминам Карты знаний.


## 31. Публичное сообщество
- [ ] Добавить отдельную hash-страницу публичной ленты и адаптивные ссылки навигации; посетители без входа могут только читать опубликованный модератором контент.
- [ ] Публичный профиль содержит только подтверждённые псевдоним/имя и краткое описание; не показывать email, auth-метаданные или приватные пользовательские данные.
- [ ] Разрешить подтверждённым неанонимным участникам отправлять публикации и комментарии, ставить/снимать реакцию и отправлять жалобу; новые профили, публикации и комментарии остаются невидимыми публично до одобрения.
- [ ] Дать модераторам серверно проверенные действия одобрения/скрытия профиля, публикации и комментария; ограничить очередь жалоб модераторами и автором жалобы; сохранять действия модерации в audit log.
- [ ] Обеспечить RLS для всех таблиц, public views только с одобренным контентом и агрегированными счётчиками, ограничения длины, базовый server-side rate limit; `service_role` не попадает во frontend.
- [ ] Если Supabase не настроен, не показывать примерную/вымышленную ленту и сообщать, что общий социальный раздел ещё не подключён.
- [ ] Не применять новую схему к Supabase и не публиковать/объявлять сообщество работающим до проверки владельческого проекта, auth callbacks, RLS и назначения доверенного модератора.
