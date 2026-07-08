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

Build artifacts are available under **Actions → workflow run → Artifacts**.

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
