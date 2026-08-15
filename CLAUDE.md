# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Gurukul is a React Native (Expo, SDK 54) school-management app ("Digital School"). One codebase serves
three audiences through role-based gating rather than separate apps: school staff (principal/admin,
teachers), students, and parents. Features span attendance, fees/payroll, report cards, messaging,
video calls, a gamified "Arena" (battle rooms, houses, leaderboards), an AI helper, and more.

- Navigation: React Navigation (native-stack), not Expo Router.
- State: no Redux/Zustand/React Query — plain React Context (`src/context/`) for session/school id/toast,
  plus local component state and hooks. Screens fetch data directly via the `src/api/*` modules.
  Realtime data (chat, calls, battle rooms) is layered in over STOMP/WebSocket instead of polling.
- Backend: a separate Spring-style REST API (see `src/api/client.ts`), reached over plain HTTP.

## Commands

```bash
npm start          # Expo dev server (dev client)
npm run android     # Build/run on Android (wraps `expo run:android` via scripts/run-android.js)
npm run ios         # Build/run on iOS simulator (macOS only)
npm run web         # Run in browser
npm run lint         # expo lint (flat ESLint config, eslint-config-expo)
npm run typecheck    # tsc --noEmit
npm test             # jest --passWithNoTests (jest-expo preset)
```

Run a single test file: `npm test -- src/__tests__/upiResponseParser.test.ts`. There are only two
test files today (`src/__tests__/`); most of the app has no automated test coverage, so don't assume
a change is covered unless you find a matching test.

CI (`.github/workflows/ci.yml`) runs lint → typecheck → test on push/PR to `main`/`develop`. Separate
workflows (`android-build.yml`, `ios-build.yml`) build native artifacts on push to `main` or manually.
EAS build profiles (`eas.json`) are `development`, `preview` (both internal APKs), and `production`.

## Architecture

### Auth/session flow and role gating

`App.tsx` is the composition root. Before login it walks a small local state machine
(`welcome → search/register school → otp/password login → role select → register`) rendering the
matching pre-auth screen. After login, session + schoolId are stored in `AuthContext`/`SchoolContext`
and one of two navigators mounts:

- `session.ownerType === 'PARENT'` → `ParentNavigator`
- everything else (`EMPLOYEE`, `STUDENT`) → `PrincipalNavigator` — despite the name, this single stack
  serves admins, teachers, and students. Feature/screen visibility is gated **inside** components by
  checking `session.role` (`'ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT'`, from `src/api/types.ts`) and
  `session.ownerType` (`'EMPLOYEE' | 'STUDENT' | 'PARENT'`), e.g. `PrincipalDashboardScreen.tsx`'s
  `TEACHER_ONLY_FEATURES` list, or `isViewerAdmin`/`isClassTeacherOfSection` checks scattered across
  screens. There are no separate role-specific navigators beyond the parent/staff split — when adding a
  role-gated feature, follow the existing per-screen `session.role === '...'` pattern rather than
  inventing a new navigator.

Session (`src/api/authStorage.ts`) and school id (`src/api/schoolStorage.ts`) persist to AsyncStorage
and are rehydrated on launch; `src/api/client.ts`'s module-level `currentToken` is kept in sync via
`setAuthToken()` whenever the session changes.

### API layer (`src/api/`)

One file per resource (`students.ts`, `feeAssessments.ts`, `payrollRuns.ts`, `battleRooms.ts`, ...),
all built on the shared `api` object in `client.ts`: `api.get/getPaginated/post/put/patch/delete`.
Conventions to preserve:

- `BASE_URL` is a hardcoded IP in `client.ts` — there's no `.env`/`app.json extra` config for it today.
- Every request sends `X-School-Id` (multi-tenant scoping) and a `Bearer` token when present; responses
  are unwrapped from an `{ success, data, message }` envelope, throwing `ApiError` on failure.
- Paginated list endpoints return `{ content, hasNext, totalElements }` via `api.getPaginated`, with
  `hasNext`/`totalElements` as siblings of `data` (not nested under it) — this is a deliberate,
  backwards-compatible shape so older installed APKs keep working; don't nest pagination metadata
  under `data` again.
- `serverNow()` corrects for device clock drift using the response `Date` header — always use it (not
  `Date.now()`) for anything comparing against a server-issued deadline (e.g. Battle Room countdowns).
- Shared request/response types live in `src/api/types.ts` (large, single file — includes `UserRole`,
  `OwnerType`, `LoginResponse`, and per-resource DTOs). Add new API types there rather than inlining.
- Realtime channels are separate modules: `chatSocket.ts`, `callSocket.ts`, `battleRoomSocket.ts` (all
  STOMP over WebSocket via `@stomp/stompjs`), plus `bedrock/` under `src/services/` for AWS Bedrock
  (AI helper) calls signed with SigV4.

### Screens and navigation

`src/screens/` holds pre-auth/shared screens; `src/screens/principal/` holds the ~90 screens used by
the staff/student stack (despite the directory name, it is not principal-only — see role gating
above). `src/navigation/PrincipalNavigator.tsx` and `ParentNavigator.tsx` register every screen against
a typed `ParamList` (`src/types/principal.ts`); when adding a screen, add both the `Stack.Screen` entry
and its param type.

### Stray legacy files — do not edit

`src/api.ts`, `src/components.tsx`, `src/screens.tsx`, `src/theme.ts`, and `src/data.ts` are leftover
monolithic files from an early prototype. They only import each other, are not imported by `App.tsx` or
any navigator, and are dead code living alongside the real `src/api/`, `src/components/`, `src/screens/`,
`src/theme/` directories. If you're looking for "the" api/screens/theme module, use the directory, not
the same-named file.

### i18n

`src/i18n/` wraps `i18next`/`react-i18next` with English and Hindi (`locales/en.json`, `locales/hi.json`).
Language is detected from AsyncStorage → device locale → `en` fallback (`initI18n()` in `App.tsx`, must
resolve before rendering). Add new user-facing strings to both locale files.

### Design references

`design/figma/*.md` holds Figma specs (principal/teacher dashboards); `docs/` is the published GitHub
Pages site (`docs/index.html`, `money-features.html`, mockup PNGs) — not related to app documentation.

### Native config quirks

Two custom Expo config plugins (`plugins/withCleartextTraffic.js`, `plugins/withUpiIntentQueries.js`)
patch native Android manifest behavior for HTTP traffic and UPI app intents (`upi`, `phonepe`, `gpay`
schemes in `app.json`'s iOS `LSApplicationQueriesSchemes`) — fee payment flows launch external UPI apps.
`npm run android` goes through `scripts/run-android.js` rather than calling `expo run:android` directly.
