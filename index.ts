import { Buffer } from 'buffer';

// @stomp/stompjs references the Node `Buffer` global when parsing binary STOMP frames;
// React Native has no such global by default, so without this it throws
// `ReferenceError: Property 'Buffer' doesn't exist` on first use (calls/chat signaling).
global.Buffer = global.Buffer ?? Buffer;

import { registerRootComponent } from 'expo';

import App from './App';

registerRootComponent(App);
