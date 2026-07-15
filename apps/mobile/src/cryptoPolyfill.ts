import * as Crypto from 'expo-crypto';

// expo-crypto ships prelinked in Expo Go (unlike react-native-get-random-values, which needs
// native linking Expo Go doesn't support for third-party modules). Without a real
// crypto.getRandomValues, amazon-cognito-identity-js silently falls back to an insecure PRNG,
// which makes its SRP auth fail with a generic "Incorrect username or password".
if (typeof globalThis.crypto !== 'object') {
  // @ts-expect-error - polyfilling the global Web Crypto API
  globalThis.crypto = {};
}
if (typeof globalThis.crypto.getRandomValues !== 'function') {
  // @ts-expect-error - expo-crypto's TypedArray union is narrower than the DOM lib's signature
  globalThis.crypto.getRandomValues = Crypto.getRandomValues;
}
