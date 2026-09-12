import type { PushSubscriptionBody } from '../shared/types.ts';

export interface VapidKeys { publicKey: string; privateKey: string }

const bytes = (value: string) => Uint8Array.from(Buffer.from(value, 'base64url'));
const b64 = (value: ArrayBuffer | Uint8Array) => Buffer.from(value instanceof Uint8Array ? value : new Uint8Array(value)).toString('base64url');
const text = (value: string) => new TextEncoder().encode(value);
const concat = (...parts: Uint8Array[]) => {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0; for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
};

export async function sendPush(
  subscription: PushSubscriptionBody,
  payload: string,
  vapid: VapidKeys,
  sender: typeof fetch = fetch,
): Promise<Response> {
  const endpoint = new URL(subscription.endpoint);
  const subscriberPublic = bytes(subscription.keys.p256dh);
  const auth = bytes(subscription.keys.auth);
  const serverPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const serverPublic = new Uint8Array(await crypto.subtle.exportKey('raw', serverPair.publicKey));
  const clientKey = await crypto.subtle.importKey('raw', subscriberPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: clientKey }, serverPair.privateKey, 256));
  const ikmKey = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveBits']);
  const info = concat(text('WebPush: info\0'), subscriberPublic, serverPublic);
  const ikm = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: auth, info }, ikmKey, 256);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const contentKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const cek = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: text('Content-Encoding: aes128gcm\0') }, contentKey, 128);
  const nonce = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: text('Content-Encoding: nonce\0') }, contentKey, 96);
  const plaintext = concat(text(payload), new Uint8Array([2]));
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, plaintext));
  const rs = new Uint8Array(4); new DataView(rs.buffer).setUint32(0, 4096);
  const body = concat(salt, rs, new Uint8Array([serverPublic.length]), serverPublic, ciphertext);

  const now = Math.floor(Date.now() / 1000);
  const jwtHeader = b64(text(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const jwtPayload = b64(text(JSON.stringify({ aud: endpoint.origin, exp: now + 12 * 60 * 60, sub: 'https://github.com/radityasurya/tautan' })));
  const rawPublic = bytes(vapid.publicKey);
  const privateKey = await crypto.subtle.importKey('jwk', {
    kty: 'EC', crv: 'P-256', x: b64(rawPublic.slice(1, 33)), y: b64(rawPublic.slice(33)), d: vapid.privateKey,
  }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, text(`${jwtHeader}.${jwtPayload}`));
  const token = `${jwtHeader}.${jwtPayload}.${b64(signature)}`;
  return sender(subscription.endpoint, {
    method: 'POST', body,
    headers: {
      authorization: `vapid t=${token}, k=${vapid.publicKey}`,
      'content-encoding': 'aes128gcm', 'content-type': 'application/octet-stream', ttl: '3600', urgency: 'high',
    },
  });
}
