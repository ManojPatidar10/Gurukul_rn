# Gurukul_rn

A minimal React Native dummy app built with [Expo](https://expo.dev) and TypeScript.

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
