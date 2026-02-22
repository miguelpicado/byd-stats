# CLAUDE.md - BYD Stats Project Guide

## Project Overview

BYD Stats is a privacy-first Progressive Web App (PWA) + Android hybrid app for monitoring and analyzing BYD electric vehicle data. It processes trip, charging, and vehicle telemetry data locally using sql.js (SQLite in the browser), with optional cloud sync via Google Drive/Firebase.

## Tech Stack

- **Frontend:** React 19 + TypeScript 5.9, Vite 7, TailwindCSS 3 (class-based dark mode)
- **Native:** Capacitor 8 for Android packaging
- **Backend:** Firebase Functions v2 (Node 20, TypeScript, region `europe-west1`)
- **Charts:** Chart.js + react-chartjs-2
- **ML/AI:** TensorFlow.js (battery SoH prediction, range estimation, efficiency analysis)
- **Database:** sql.js (local SQLite), Firebase/Firestore (cloud sync)
- **i18n:** i18next — 6 languages (ES, EN, PT, GL, CA, EU)
- **Testing:** Vitest (unit) + Playwright (E2E)
- **Validation:** Zod 4
- **Maps:** Leaflet + react-leaflet

## Key Commands

```bash
npm run dev            # Start dev server (Vite)
npm run build          # Production build
npm run type-check     # TypeScript check (tsc --noEmit)
npm test               # Run Vitest tests
npm run test:core      # Test core modules only
npm run test:coverage  # Coverage report (thresholds: 60% stmts, 50% branches)
npm run android:build  # Build debug APK (build + cap sync + gradle)
npm run deploy         # Deploy to GitHub Pages
```

## Project Structure

```
src/
├── components/        # UI components (cards/, common/, layout/, modals/, settings/, ui/, lists/)
├── context/           # React contexts: AppContext, CarContext, LayoutContext
├── core/              # Pure business logic (batteryCalculations, chargingLogic, dataProcessing, dateUtils, formatters, constants)
├── features/          # Feature modules (dashboard/tabs/, navigation/)
├── hooks/             # 40+ custom hooks (sync/, useDatabase, useGoogleSync, useAppOrchestrator...)
├── pages/             # Route-level pages (Landing, Legal, FAQ)
├── providers/         # Context providers (AppProviders, DataProvider, TripsProvider, ChargesProvider)
├── routes/            # Routing configuration
├── services/          # External integrations (ai/, bydApi, firebase, googleDrive, AnomalyService)
├── types/             # TypeScript type definitions
├── utils/             # Utility functions
├── workers/           # Web Workers (dataWorker, tensorflowWorker)
├── i18n/              # i18next configuration
functions/
├── src/
│   ├── byd/           # BYD API client (client.ts, crypto.ts) — 9 remote commands
│   ├── bydFunctions.ts # 47 Firebase callable functions
│   └── index.ts       # Function exports
android/               # Capacitor Android project
docs/                  # Documentation (API_MAPPING, BYD_API_Reference, TROUBLESHOOTING...)
public/locales/        # Translation JSON files (es/, en/, pt/, gl/, ca/, eu/)
```

## Path Aliases (tsconfig + vite)

```
@/*           → ./src/*
@components/* → ./src/components/*
@hooks/*      → ./src/hooks/*
@core/*       → ./src/core/*
@utils/*      → ./src/core/*          (maps to core, not a separate utils dir)
@features/*   → ./src/features/*
@tabs/*       → ./src/features/dashboard/tabs/*
@services/*   → ./src/services/*      (vite only, not in tsconfig)
```

Always use these aliases in imports instead of relative paths.

## Architecture & Patterns

- **State management:** React Context API only (no Redux/Zustand). Three main contexts: `AppContext`, `CarContext`, `LayoutContext`.
- **Provider pattern:** Data flows through nested providers (`DataProvider` → `TripsProvider` → `ChargesProvider`...).
- **Orchestrator pattern:** `useAppOrchestrator` coordinates complex multi-step state flows.
- **Web Workers:** Heavy computations (TensorFlow inference, data processing) run off the main thread.
- **Lazy loading:** Route-level components use `React.lazy()` + `Suspense`.
- **Virtualized lists:** `@tanstack/react-virtual` for large datasets.
- **Privacy-first:** All data processed locally. Cloud sync is optional and user-controlled.
- **Offline-first PWA:** Service worker via Workbox. Works fully offline after initial load.

## Coding Conventions

- **Language:** TypeScript strict mode (`noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`).
- **Components:** PascalCase, functional components with hooks only. No class components.
- **Functions/variables:** camelCase.
- **Constants:** SCREAMING_SNAKE_CASE (in `src/core/constants.ts`).
- **Hooks:** Always prefixed with `use` (e.g., `useDatabase`, `useAutoChargeDetection`).
- **Styling:** TailwindCSS utility classes. Dark mode via `dark:` variant (class-based).
- **Translations:** All user-facing strings must use `t('key')` from i18next. Translation files are in `public/locales/{lang}/`.
- **File naming:** PascalCase for components (`.tsx`), camelCase for logic files (`.ts`).

## Testing

- **Unit tests:** Vitest with jsdom, globals enabled. Test files co-located or in `__tests__/` folders.
- **E2E tests:** Playwright in `e2e/` directory. Chromium + Mobile Chrome. Locale: `es-ES`.
- **Mocks:** `src/__mocks__/` directory for shared mocks.
- **Coverage thresholds:** 60% statements, 50% branches, 60% functions, 60% lines.
- **Run tests before submitting changes:** `npm test` for unit, `npx playwright test` for E2E.

## Environment Variables

All prefixed with `VITE_` for frontend access:

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_GOOGLE_WEB_CLIENT_ID
VITE_GOOGLE_ANDROID_CLIENT_ID
VITE_SMARTCAR_CLIENT_ID          (optional)
VITE_SMARTCAR_REDIRECT_URI       (optional)
```

Never commit `.env` files. Use `.env.example` as reference.

## Firebase Functions (Backend)

- Located in `functions/src/`.
- Region: `europe-west1`.
- Runtime: Node 20.
- BYD API client in `functions/src/byd/client.ts` handles vehicle communication (lock/unlock, climate, windows, charging, location, etc.).
- Crypto operations in `functions/src/byd/crypto.ts`.
- Deploy with: `firebase deploy --only functions`.
- Functions use v2 callable format (`onCall` from `firebase-functions/v2/https`).

## Important Notes

- The `@utils/*` alias maps to `src/core/`, NOT a separate `src/utils/` directory.
- Business logic belongs in `src/core/`, not in components or hooks.
- Components should not contain complex calculations — delegate to core modules or Web Workers.
- When adding new translatable strings, add keys to ALL 6 locale files in `public/locales/`.
- Capacitor plugins need both web and Android implementations. Test on both platforms.
- The app ID for Android is `com.bydstats.app`.
- GitHub Pages deployment uses relative base path (`./`).
