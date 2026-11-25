'use strict';
// Browser versions of the two node:crypto helpers the server code touches.
function randomBytes(n) {
  const a = new Uint8Array(n);
  globalThis.crypto.getRandomValues(a);
  return Array.from(a);
}
function randomInt(min, max) {
  if (max === undefined) { max = min; min = 0; }
  const range = max - min;
  const a = new Uint32Array(1);
  globalThis.crypto.getRandomValues(a);
  return min + (a[0] % range);
}
module.exports = { randomBytes, randomInt };
