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
- Android Studio (SDK + an AVD), or Xcode for the iOS simulator

> **Expo Go will not run this app.** It depends on native modules that aren't in the Go
> runtime (`@react-native-google-signin`, `expo-camera`, `react-native-webview`) and on config
> plugins under `plugins/`, so it needs a **development build** — hence `expo start --dev-client`
> in `npm start`. Build one once with `npx expo run:android` (or EAS), after which
> `npm run android` just reconnects to it.

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

### Against a local backend

By default the app talks to production (`https://api.smartgurukul.org`). To point it at a backend
running on your own machine:

```bash
# 1. Emulator. `emulator` is not on PATH by default.
$ANDROID_HOME/emulator/emulator -avd "$($ANDROID_HOME/emulator/emulator -list-avds | head -1)" &

# 2. Backend (separate terminal). In-memory H2, so it starts empty every time.
cd ../backend && set -a; . ./.env.local; set +a && ./mvnw spring-boot:run

# 3. Demo data - a student login and a payable fee. Re-run after every backend restart.
cd ../backend && ./scripts/seed-demo-fees.sh

# 4. The app.
cd ../frontend && npm run android
```

`.env` should contain `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8080` — `10.0.2.2` is how the
Android emulator reaches the host's localhost. On a **physical device** use your machine's LAN IP
instead, or forward the ports with
`adb reverse tcp:8081 tcp:8081 && adb reverse tcp:8080 tcp:8080`.

`EXPO_PUBLIC_*` values are inlined at bundle time, so changing `.env` needs Metro restarted with a
cleared cache: `npx expo start -c`.

### Gotchas

- **`app.json` declares no `scheme`**, so launching via a deep link (`adb shell am start -d
  com.gurukul.rn://...`) fails with "unable to resolve Intent". Open the app from the launcher and
  pick the dev server from the list instead.
- **Fast Refresh resets React state but Android keeps native `TextInput` text.** After editing a
  file, a login form can look filled while the component's state is empty, so submitting silently
  does nothing. Force-stop and relaunch rather than reusing the form.
- **The emulator has no UPI app installed**, so the fee-payment deep link can never resolve and you
  always get the "pay manually" fallback. Testing the real UPI handoff needs a physical device with
  PhonePe/GPay. Razorpay Checkout works fine on the emulator (see
  `../backend/docs/razorpay-setup.md`).

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
