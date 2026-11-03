## Home page organized around books and cycles
- [x] The home page does not show cards for individual lessons, recent lectures, or individual progress items.
- [x] Book-linked study cycles are presented under books, and selecting a card opens that book’s ordered audio cycle.
- [x] Cycles without a registered book remain available as audio-cycle cards; do not invent book associations.

## Automatic next lesson
- [x] When a lesson reaches its natural end, automatically start the next lesson in the same ordered course.
- [x] If “Repeat lesson” is enabled, replay the current lesson instead of advancing.
- [x] At the final lesson, stop and remain paused rather than wrapping automatically to the first lesson.

## Playback position recovery
- [x] Save the current lecture and latest playback position locally when the page is hidden or unloaded.
- [x] After reload, reopen the saved lecture and seek to its saved time only after audio metadata is available.
- [x] Keep playback paused after reload; tapping Play resumes at the restored position.
- [x] Do not overwrite a valid saved position with zero while the audio is still loading.

## Mini-player gestures
- [x] The bottom mini-player can be dismissed with a downward swipe and restored by pressing a visible up-arrow button.
- [x] Hiding the mini-player does not pause, stop, or reset the audio; playback controls remain available again after restoring it.
- [x] The gesture and restore button remain usable on mobile and desktop and have accessible button labels.
- [x] Swiping left advances to the next track; swiping right returns to the previous track.
- [x] Swipes that begin on buttons, seek/volume sliders, or selectors do not change tracks.

## Books and audio collections
- [x] Раздел «Книги» показывает только проверенное издание и ведёт к PDF и официальной странице источника.
- [x] Связанная карточка книги открывает цикл «Три основы» с 18 аудиозаписями.
- [x] Каталог «Курсы» показывает все опубликованные учебные циклы, включая «Необходимые вопросы для каждого» из 111 записей.
- [x] Уроки и кнопки предыдущего/следующего трека работают по номеру урока, включая составную нумерацию.
- [x] Официальные аудиоссылки не копируются в репозиторий и остаются вне офлайн-кэша.

## Lecture self-tests
- [x] Создать локальный конструктор вопросов с вариантами ответов.
- [x] Выбрать правильный вариант и сохранять тест отдельно для каждой лекции.
- [x] Проходить тест и показывать результат после ответа на все вопросы.
- [x] Поддержать офлайн-режим через localStorage.
- [ ] Синхронизировать тесты между устройствами через Supabase.
