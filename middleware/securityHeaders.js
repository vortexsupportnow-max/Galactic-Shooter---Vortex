'use strict';

const { isProduction } = require('../config');

// The app serves no inline <script> and loads no third-party JS, so script-src can
// stay strict. Inline style attributes are used throughout the UI, hence
// 'unsafe-inline' for styles only, plus the Google Fonts hosts used by index.html.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join('; ');

// Upgrading subresources only makes sense once the site is actually on HTTPS.
const PROD_CSP = `${CSP}; upgrade-insecure-requests`;

module.exports = function securityHeaders(req, res, next) {
  res.setHeader('Content-Security-Policy', isProduction ? PROD_CSP : CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(), usb=()');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  // API responses carry per-user data — never let a shared cache keep them.
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
  }

  if (isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
};
