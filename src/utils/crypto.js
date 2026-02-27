/**
 * Browser-native SHA-256 hashing using Web Crypto API.
 * No external dependencies. Works in all modern browsers.
 */
export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data     = encoder.encode(password + "admri_salt_v1");
  const hashBuf  = await window.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyPassword(password, hash) {
  const computed = await hashPassword(password);
  return computed === hash;
}
