'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// Accounts here have no email, so a recovery code is the only self-service way
// back into a locked-out account. It is shown to the player exactly once and only
// its bcrypt hash is stored, so a leaked database does not hand out account access.
//
// Alphabet excludes 0/O/1/I/L: these codes get written on paper and typed back by
// hand. 31^12 ≈ 7.9e17 combinations, which stays out of brute-force range even if
// an attacker gets the hashes and works offline.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const GROUPS = 3;
const GROUP_LEN = 4;
const BCRYPT_ROUNDS = 10;

function generateRecoveryCode() {
  const groups = [];
  for (let g = 0; g < GROUPS; g++) {
    let group = '';
    for (let i = 0; i < GROUP_LEN; i++) {
      group += ALPHABET[crypto.randomInt(ALPHABET.length)];
    }
    groups.push(group);
  }
  return `VRTX-${groups.join('-')}`;
}

// Players retype these from a note: forgive case, spaces and missing dashes.
function normalizeRecoveryCode(raw) {
  return String(raw == null ? '' : raw).toUpperCase().replace(/[^0-9A-Z]/g, '');
}

function hashRecoveryCode(code) {
  return bcrypt.hash(normalizeRecoveryCode(code), BCRYPT_ROUNDS);
}

function verifyRecoveryCode(code, hash) {
  return bcrypt.compare(normalizeRecoveryCode(code), hash);
}

module.exports = { generateRecoveryCode, normalizeRecoveryCode, hashRecoveryCode, verifyRecoveryCode };
