# Global study backup reminder

App.tsx gates study navigation and remembers the pending action. Startup checks use a seven-day grace period stored separately from successful exports. Focus, visibility and cross-tab storage events recheck preferences; reminders wait until navigation when a study module is already open, and do not interrupt Walking Mode or a running extra activity. The native modal dialog traps focus, blocks background interaction and restores focus on close. Escape postpones until the end of the local calendar day.

The interval is strictly greater than seven elapsed 24-hour periods. Reminder keys are global, independent of study/interface language. A third key, bej-backup-reminder:monitoring-started-at, preserves the first monitoring reference without claiming a backup occurred. Invalid or future export timestamps fall back to the monitoring reference; invalid/future references are repaired with a fresh grace period. Storage errors use an in-memory fallback without touching study data. With storage unavailable this fallback cannot survive a reload or synchronize tabs.

The shared export function preserves studyTracker.seal(), backupOf(readStudyStore()), schema version 1, application identity, JSON contents and the bej-study-backup-{mobile|desktop}-{timestamp}.json filename. Success means generation and download initiation, not confirmation of a physical save. Only successful initiation records the export timestamp; failed downloads leave the dialog open with an error. Restoration is unchanged.

## Actual coverage

StudyBackup contains studyData: confirmed study sessions (including recorded extra activities), manual adjustments, total goals and monthly goals across study languages. Favorites, app preferences, personal flashcards and an unfinished extra-activity draft are not included. Reminder preferences are also outside this backup. No reliable earlier export timestamp was persisted by the previous export code.

## Validation

npm run test:backup checks timestamps, local days, grace period, reloads, shared storage across controller instances, storage failures, non-reminder key preservation, and the shared exporter with simulated successful/failed download initiation. Navigation protections are checked from source wiring. npm run build, npm run validate:i18n, npm run test:study and npm run test:flashcards cover existing contracts. Interactive desktop/mobile focus and playback checks still require browser verification.

Observed validation: reminder tests, study suite and i18n pass. The flashcard suite fails at scripts/test-chunk-flashcards.mjs:204 (position 3 versus expected 1); the failure also reproduces with HEAD translations and the unchanged component/runtime sources. Favorite tests pass separately. Manual browser/device verification remains outstanding.
