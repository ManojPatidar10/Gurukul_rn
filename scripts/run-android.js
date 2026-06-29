const { spawnSync, spawn } = require('child_process');
const fs = require('fs');

function hasCommand(command) {
  const result = spawnSync(process.platform === 'win32' ? 'where' : 'which', [command], {
    stdio: 'ignore',
    shell: false,
  });
  return result.status === 0;
}

function hasAndroidSdk() {
  const sdkPaths = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT, process.env.ANDROID_SDK].filter(Boolean);
  const hasSdkPath = sdkPaths.some((value) => value && fs.existsSync(value));
  return hasSdkPath && hasCommand('adb');
}

if (hasAndroidSdk()) {
  console.log('Android SDK detected. Launching Expo for Android...');
  const child = spawn('npx', ['expo', 'start', '--android'], { stdio: 'inherit', shell: true });
  child.on('exit', (code) => process.exit(code || 0));
} else {
  console.log('Android SDK or adb was not detected.');
  console.log('Starting the Expo dev server instead.');
  console.log('Install Android Studio with the SDK and ADB, or use Expo Go on a physical device to run the app.');
  const child = spawn('npx', ['expo', 'start'], { stdio: 'inherit', shell: true });
  child.on('exit', (code) => process.exit(code || 0));
}
