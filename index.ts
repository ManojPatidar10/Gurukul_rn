import './src/polyfills';
// Defines the bus-location background task - must run before the app renders (see busTracking.ts).
import './src/transport/busTracking';
import { registerRootComponent } from 'expo';

import App from './App';

registerRootComponent(App);
