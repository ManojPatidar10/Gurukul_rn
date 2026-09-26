import { Buffer } from 'buffer';

// @stomp/stompjs references the Node `Buffer` global when parsing binary STOMP frames;
// React Native has no such global by default, so without this it throws
// `ReferenceError: Property 'Buffer' doesn't exist` on first use (calls/chat signaling).
// Imported first from index.ts so it runs before any other module loads.
const globalWithBuffer = globalThis as { Buffer?: typeof Buffer };
globalWithBuffer.Buffer = globalWithBuffer.Buffer ?? Buffer;
