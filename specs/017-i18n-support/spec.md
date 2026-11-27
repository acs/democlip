# Feature Specification: Internationalization (i18n) — Spanish and English

**Feature Branch**: `feat/i18n-support`

**Created**: 2026-11-27

**Status**: Draft

**Input**: User description: "Add i18n support. Implement spanish (es_ES) and english (en_UK, the current one) in the first version. Use the same approach than in Graditone if possible."

## Clarifications

### Session 2026-11-27

- Q: Should the translation mechanism handle singular/plural forms, or should every count-bearing message be written so a single form reads correctly at any count? → A: **No plural support** — every count-bearing sentence is written so one form reads correctly at any count (the number shown with an invariant label), matching the reference approach.
- Q: Should the first version let a person choose the interface language inside the app, or should it follow the browser's language only? → A: **Follow the browser's language only** — no in-app chooser; changing the browser or operating-system language and reloading changes the app, as in the reference. A manual chooser and a stored choice are deferred.
- Q: Which of the app's own declared names should be translated? → A: **Labels yes, marks no** — the app's descriptive labels (annotation-kind names, colour names, the stock-sound names it serves) are translated like any other interface text; only the app's name and its logo names are marks and stay as they are.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A Spanish speaker gets the app in Spanish, without asking (Priority: P1)

A person whose browser or operating system is set to Spanish opens DemoClip. Nothing
is installed and nothing is chosen: the header, the source row, the record bar, the
timeline, every dialog, the help, the status lines and the accessible names are already
in Spanish. A person whose machine is in English sees the app exactly as it is today.

**Why this priority**: This is the whole deliverable. The value of i18n is that the app
meets a person in their own language on first load; everything else here is about making
that trustworthy and cheap to extend. Without it there is no feature.

**Independent Test**: Load the app in a browser whose preferred language is Spanish and
walk the main flow — turn a source on, record, cut, open the help — and confirm the words
are Spanish. Load it in an English browser and confirm the words are exactly today's.

**Acceptance Scenarios**:

1. **Given** a browser whose preferred language is Spanish (`es`), **When** the person opens DemoClip, **Then** every user-facing word in the interface is Spanish.
2. **Given** a browser set to a Spanish variant (`es-ES`, `es-MX`, `es-AR`), **When** the person opens the app, **Then** the Spanish catalogue is used.
3. **Given** a browser set to an English variant (`en-GB`, `en-US`, `en-AU`), **When** the person opens the app, **Then** the app is in English, exactly as today.
4. **Given** a browser whose preferred language is neither English nor Spanish (`fr`, `de`, `ja`, `zh-Hant-TW`), **When** the person opens the app, **Then** it is in English rather than a blank, a raw key, or a half-translated surface.
5. **Given** the app already open, **When** the person changes their browser language and reloads, **Then** the whole interface is in the newly chosen language.

---

### User Story 2 - The English experience is untouched (Priority: P1)

A person who has used DemoClip until now updates and carries on. Every label, tooltip,
status line and help sentence reads exactly as it did before, and English is what any
language the app does not yet speak falls back to. English is the app's source text, and
the Spanish version is written from it rather than the other way round.

**Why this priority**: Introducing translation is exactly where an interface quietly
regresses — a label reworded, a sentence that used to concatenate now reads oddly. The
existing English words are the contract, and the fallback is what keeps every unsupported
language usable.

**Independent Test**: Compare the interface, word for word, against the previous version
on an English browser: no visible string differs. Then remove a Spanish entry and confirm
the English sentence appears where it would, with nothing blank.

**Acceptance Scenarios**:

1. **Given** an English browser, **When** the app is opened after the change, **Then** every visible word is identical to the previous version's.
2. **Given** a Spanish browser and a message whose Spanish entry is missing, **When** that message would show, **Then** the English sentence is shown — never a key, a placeholder or a blank.
3. **Given** an unsupported browser language, **When** the app is opened, **Then** the whole interface is English.
4. **Given** any locale, **When** the app fails to find a translation, **Then** it degrades to English and never shows an empty surface.

---

### User Story 3 - Every surface is translated, nothing is left behind (Priority: P2)

A Spanish speaker uses the whole app, not just its first screen: the clip's own settings
panel, the annotate options and the properties inspector, the text-entry dialog, the export
menu, the publish dialogs for Bluesky and YouTube, the profile and project selectors and
their dialogs, the project overview, the in-app help panel, the separate help page, the
toasts, the error messages, the tooltips and every accessible name. A surface that stayed
English would read as a bug, not as a translation.

**Why this priority**: A half-translated interface is worse than an untranslated one, because
it tells the person the app is not really theirs. It depends on the mechanism from US1
existing, so it follows it.

**Independent Test**: Switch to Spanish and visit every surface — record, cut, annotate,
change a clip property, export, open each publish dialog, open a profile and a project, open
the help panel and the help page — and confirm no English is left.

**Acceptance Scenarios**:

1. **Given** a Spanish browser, **When** the person opens the help panel and the help page, **Then** their headings, body text and the footer are Spanish.
2. **Given** a Spanish browser, **When** the person opens the Bluesky and YouTube dialogs, **Then** their notes, field labels, buttons and status lines are Spanish.
3. **Given** a Spanish browser, **When** the person opens the profile and project dialogs, **Then** their titles, explanations and controls are Spanish.
4. **Given** a Spanish browser, **When** a status line, a toast or an error appears, **Then** it is Spanish.
5. **Given** a Spanish browser, **When** a screen reader inspects the app, **Then** every accessible name and tooltip is Spanish.
6. **Given** a Spanish browser, **When** the annotate options, the clip settings and the properties inspector are shown, **Then** their labels and colour names are Spanish.

---

### User Story 4 - A new language is a small change, and a half-done one cannot ship (Priority: P3)

A contributor adds a third language later — French, say — by writing one new catalogue and
registering it, without touching a single screen. And because the catalogues are held in
step, a language that is only partly written fails loudly instead of shipping with silent
gaps: the same set of keys exists in every language, and any key the English source adds
must appear everywhere before the build passes.

**Why this priority**: It is what makes the first version pay forward, and it is the part of
Graditone's approach that has proved most valuable. It is not needed for the MVP to deliver
value, so it comes last.

**Independent Test**: Add a French catalogue, register the language, set the browser to
French, and confirm French appears with no change to any screen. Then remove a key from one
catalogue and confirm the check fails.

**Acceptance Scenarios**:

1. **Given** the mechanism in place, **When** a new language catalogue is added and registered, **Then** a browser set to that language shows the app in it, with no change to any view.
2. **Given** a new catalogue missing a key the English source has, **When** the project's checks run, **Then** the build fails rather than shipping the gap.
3. **Given** two catalogues, **When** one holds a key the other does not, **Then** the check reports the difference in both directions.

---

### Edge Cases

- **A complex language tag** (e.g. `zh-Hant-TW`): only the primary subtag (`zh`) decides the language; when it is unsupported the app falls back to English.
- **A browser offering several languages**: the person's preferred (first) language decides; if it is unsupported the app falls back to English rather than scanning further, matching the reference approach.
- **No browser language at all** (a bot, a stripped environment): the app is English.
- **A value inside a sentence** (a clip length, a signed-in handle, a published URL): the value is placed into the translated sentence rather than glued to it, so a language may put it in another position without breaking the sentence.
- **A count inside a message** (how many recordings are finished, how many are left): the sentence is written so one form is correct at any count — the number shown with an invariant label — rather than changing its wording with the count.
- **Text the person wrote** (a clip title or description, a project name and description, a profile's name): it is theirs and is never translated.
- **The app's own name and brand** (`DemoClip`, the served logo names): they are marks, not words, and are never translated.
- **A catalogue that fails to load**: not applicable — the catalogues travel with the app and cannot fail apart from it.
- **Right-to-left languages**: out of scope for this version; neither supported language needs a mirrored layout.
- **The exported video**: the title card carries the person's own words, the app's name and the date; only the app's name is a fixed word and it is a mark, so nothing on the card is translated.
- **The document title shown in the browser tab**: the app's own page title is its name and stays; the help page's title carries words (*How to use*) and is translated with its body, so the tab and the page agree.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST choose the interface language from the person's preferred browser or operating-system language, using only the primary language subtag (so `es-MX` is treated as `es`).
- **FR-002**: When the preferred language is Spanish (`es` or any `es-*` variant), the system MUST show the interface in Spanish (`es_ES`).
- **FR-003**: When the preferred language is English (`en` or any `en-*` variant), the system MUST show the interface in English (`en_UK`), which is also the default.
- **FR-004**: When the preferred language is not supported, the system MUST show the interface in English rather than an empty, keyed or partly translated surface.
- **FR-005**: Every user-facing string in the app MUST come from a translation catalogue and not from text written into the interface. This covers, at least: the header and toolbar, the source row and record bar, the timeline and cutting controls, the clip settings panel, the annotate options, the properties inspector, the text-entry dialog, the export menu, the Bluesky and YouTube dialogs, the profile and project selectors and their dialogs, the project overview, the in-app help panel, the separate help page, status lines, toasts, error messages, tooltips and every accessible name.
- **FR-006**: The English catalogue MUST be the source of truth: every translation key exists in it, and it holds exactly today's words so the English experience is unchanged.
- **FR-007**: The Spanish catalogue MUST hold an entry for every key the English catalogue holds, and the two catalogues MUST be kept in step, so a language cannot ship with missing entries.
- **FR-008**: When a key has no entry in the active language, the system MUST show the English sentence for that key.
- **FR-009**: The translation catalogues MUST be discrete, one per language, and MUST travel with the app — never fetched over the network at runtime — so the language is present at first paint with no added wait.
- **FR-010**: The interface MUST contain no language-specific conditional logic; choosing and applying a language MUST be the translation mechanism's job alone.
- **FR-011**: Adding a new language MUST require only a new catalogue and its registration, with no change to any view or interaction code.
- **FR-012**: A message that carries a value MUST place that value into the translated sentence, so the wording and the position of the value are the language's own.
- **FR-013**: Text the person supplies — a clip title or description, a project name or description, a profile name — MUST never be translated.
- **FR-014**: The app's own name and brand marks MUST never be translated.
- **FR-015**: Accessible names — the text a screen reader announces for a control — and tooltips MUST be translated through the same mechanism as visible text.
- **FR-016**: The page MUST declare its active language so assistive technology announces the interface in the language it is shown in.
- **FR-017**: The project's checks MUST fail when the catalogues are not in step — a key missing from any language, or present in one and not another.
- **FR-018**: The translation mechanism MUST NOT need plural forms: every message that carries a count MUST be written so a single form reads correctly at any count, and the app MUST NOT choose between singular and plural wording.
- **FR-019**: The app's own descriptive labels — annotation-kind names, colour names and the stock-sound names it serves — MUST be translated like any other interface text; only the app's name and its logo names are marks and stay as they are.

### Key Entities *(include if feature involves data)*

- **Translation catalogue**: the set of sentences for one language — a flat list of stable identifiers mapped to the text a person reads in that language. One per supported language; the English one is the source the others are written from.
- **Translation key**: the stable, language-independent identifier for one user-facing sentence (for example, the record button's label, the Bluesky sign-in note). A key is written once and never changes as languages are added; only its text differs per language.
- **Locale**: one of the languages the app speaks — English (`en_UK`) and Spanish (`es_ES`) in this version. English is the default.
- **Locale preference**: the language the person's browser or operating system declares (a tag such as `es`, `es-MX`, `en-GB`). It selects the locale when the app loads; it is read, never stored by the app.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the app's user-facing strings exist in both the English and the Spanish catalogue; zero hardcoded interface strings remain.
- **SC-002**: A person whose browser is Spanish sees zero English interface strings on any surface, from first load through recording, cutting, annotating, exporting and publishing.
- **SC-003**: A person whose browser is English, or any unsupported language, sees zero untranslated keys and zero blank strings; the interface is entirely English.
- **SC-004**: Adding a third language requires at most two file changes — the new catalogue and its registration — and zero changes to any view or interaction code.
- **SC-005**: The catalogues can never disagree: a missing or orphaned key fails the project's checks, so a half-translated language cannot ship.
- **SC-006**: The English interface after the change is identical, word for word, to the interface before it.
- **SC-007**: The translation mechanism adds no perceptible delay to the app appearing: the language is present with the app rather than fetched, so the time to first paint is unchanged.
- **SC-008**: Language selection and fallback are demonstrably correct for every kind of language tag and for a missing entry, and the Spanish interface is demonstrably correct when the real app is opened in a browser whose preferred language is Spanish.

## Assumptions

- **The first version speaks two languages.** English (`en_UK`), today's language and the default, and Spanish (`es_ES`). The set is open: more languages come later, which is why extensibility is a requirement and not a nicety.
- **The approach follows Graditone's, which has already proved it.** A small locale registry, one flat catalogue per language bundled with the app, detection from the browser's preferred language, English as the source and the fallback, catalogues held in step, and no i18n library — a lightweight mechanism of a few dozen lines. The project's own words for the new concepts are written into `docs/GLOSSARY.md` in the change that introduces them, as the constitution requires.
- **The language follows the browser, not a setting of the app's.** As in Graditone, this version has no in-app language chooser: the person changes their browser or operating system language and reloads. A manual chooser, and remembering a choice, is deliberately deferred.
- **Only the primary language subtag matters.** Any Spanish variant uses `es_ES` and any English variant uses `en_UK`; the app does not distinguish regions, because neither catalogue is regional.
- **All app surfaces are in scope, and only the app's own.** The interface, its dialogs, the help panel and the separate help page are translated. The developer documentation (`README.md`, `docs/`), the automation surface's tool names and descriptions (which an agent reads, not a person), and the app's own name and brand marks are not.
- **The person's own words are untouched, and the app's labels are translated.** Clip titles and descriptions, project names and descriptions, and profile names are not translated — they are the person's. The app's own descriptive labels — annotation-kind names, colour names and the stock-sound names it serves — are translated like any other interface text; only the app's name and the logo names are marks and stay as they are.
- **Formatting is unchanged in this version.** Dates and numbers are shown as they are today (the title card's date stays as it is); localising date, number and plural formats is a later concern, because neither supported language needs a different shape for what the app shows.
- **Right-to-left layout is out of scope**, since neither supported language needs it.
- **The interface language is fixed when the app loads.** With no in-app chooser, a change takes effect on reload; nothing needs to re-render live in this version.
- **The English words are the contract.** Where a translation would need a label reworded in English to read well, the English stays as it is and the Spanish is written to fit it, because changing English is a separate, deliberate change.

## Dependencies

- The app's existing interface text, held today in the page, the help page and the view modules, which this change moves into catalogues.
- The app's existing help panel and separate help page, which are part of the app and are translated with it.
- The project's check setup, which gains the catalogue-parity check and the browser check that loads the app in Spanish.
