export const VAPID_PUBLIC_KEY_FINGERPRINT_STORAGE_KEY = 'vortixia-vapid-public-key-fingerprint';

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function vapidPublicKeyToUint8Array(publicKey: string): Uint8Array<ArrayBuffer> {
  const compactKey = publicKey.trim().replace(/\s+/g, '');
  const padding = '='.repeat((4 - (compactKey.length % 4)) % 4);
  const base64 = (compactKey + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const decoded = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(decoded.length));

  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }

  return bytes;
}

export function normalizeVapidPublicKey(publicKey: string): string {
  return bytesToBase64Url(vapidPublicKeyToUint8Array(publicKey));
}

export async function deriveVapidPublicKeyFingerprint(publicKey: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Secure key fingerprinting is unavailable in this browser');
  }

  const keyBytes = vapidPublicKeyToUint8Array(publicKey);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', keyBytes.buffer);

  return bytesToBase64Url(new Uint8Array(digest));
}

export async function subscriptionUsesCurrentVapidKey(
  subscription: PushSubscription,
  currentPublicKey: string,
  storedFingerprint: string | null,
): Promise<boolean> {
  const applicationServerKey = subscription.options?.applicationServerKey;

  if (applicationServerKey) {
    const existingKey = bytesToBase64Url(new Uint8Array(applicationServerKey));
    return existingKey === normalizeVapidPublicKey(currentPublicKey);
  }

  if (!storedFingerprint) {
    return false;
  }

  return storedFingerprint === await deriveVapidPublicKeyFingerprint(currentPublicKey);
}
