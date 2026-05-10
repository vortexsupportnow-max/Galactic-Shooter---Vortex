'use strict';

const JWT_SECRET = process.env.JWT_SECRET || 'galactic-shooter-secret-2024';

if (!process.env.JWT_SECRET) {
  console.warn(
    'WARNING: JWT_SECRET env var not set. Using insecure default secret. ' +
    'Set JWT_SECRET in production environments.'
  );
}

module.exports = { JWT_SECRET };
