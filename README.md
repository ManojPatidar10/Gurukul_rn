# Gurukul_rn

A React Native (Expo) app for **Digital School** — starting with the Trustee / Principal analytical dashboard.

## Principal Dashboard Features

| Module | Description |
|--------|-------------|
| **Attendance** | Live student & faculty tracking, class-wise breakdown |
| **Payments** | Fee collection, salary processing, automated reminders |
| **Progress Cards** | Class-wise and subject-wise performance reports |
| **Notice Board** | Separate broadcast channels for parents and teachers |
| **Admissions** | End-to-end enrollment pipeline |
| **AI Chatbot** | Natural-language queries for instant data lookup |
| **Schedule** | Centralized timetable with conflict detection |
| **Inventory** | School supplies and assets with low-stock alerts |

## Design

- Figma spec: [`design/figma/principal-dashboard-spec.md`](design/figma/principal-dashboard-spec.md)
- UI mockup: [`assets/principal-dashboard-mockup.png`](assets/principal-dashboard-mockup.png)

## Prerequisites

- Node.js 20+
- npm
- [Expo Go](https://expo.dev/go) on a physical device, or Android Studio / Xcode for emulators

## Setup

```bash
git clone https://github.com/<your-org>/Gurukul_rn.git
cd Gurukul_rn
npm install
```

## Run locally

```bash
# Start the Expo dev server
npm start

# Android emulator or device
npm run android
c
# iOS simulator (macOS only)
npm run ios

# Web browser
npm run web
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start Expo dev server |
| `npm run android` | Run on Android |
| `npm run ios` | Run on iOS (macOS) |
| `npm run web` | Run in browser |
| `npm run lint` | Lint source code |
| `npm run typecheck` | TypeScript type check |
| `npm test` | Run unit tests |

## CI/CD

GitHub Actions workflows in `.github/workflows/`:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | Push / PR to `main`, `develop` | Lint, typecheck, and test |
| `android-build.yml` | Push to `main`, manual | Build Android release APK |
| `ios-build.yml` | Push to `main`, manual | Build iOS simulator binary |
| `eas-update.yml` | Push to `main`, manual | Publish the latest JavaScript for Expo Go (channel `main`) |
| `eas-preview.yml` | Push to `main`, manual | Keep the installable Android preview APK on expo.dev up to date |

Build artifacts are available under **Actions → workflow run → Artifacts**.

### Try the latest app without the Play Store

- **Expo Go (any phone, signed in to an Expo account with access to the project):** open
  `exp://u.expo.dev/f610c224-f96d-4706-a22c-38f27170b00c?channel-name=main&runtime-version=exposdk:57.0.0`.
  It always loads the newest version from `main`.
- **Android preview APK:** install the newest **preview** build from
  https://expo.dev/accounts/yashcodes105/projects/gurukul-rn/builds once. After that the app updates
  itself: every merge to `main` publishes to the `preview` update branch, and the app picks it up on
  the next launch (the update applies on the launch after that). When native code changes, the
  `eas-preview.yml` workflow builds a new APK automatically (the runtime version is a fingerprint of
  the native code, `APP_VARIANT=preview` in `app.config.js`), and you install that one once.
  It is signed with a different key from the Play Store app, so uninstall the Play Store version first.
- **One-time setup** (before the workflow can build): someone signed in to an Expo account with access
  to the project runs `npx eas-cli build --profile preview --platform android` once from this repo and
  answers "yes" to generating a new Android keystore, so EAS stores the signing key.

## Project structure

```
.
├── App.tsx              # Root component
├── app.json             # Expo config
├── assets/              # Icons and images
├── index.ts             # App entry point
├── package.json
└── .github/
    └── workflows/       # CI/CD pipelines
```

## License

MIT
