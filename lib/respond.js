'use strict';

const { isTest } = require('../config');

const GENERIC_ERROR = 'Something went wrong. Please try again.';

// Unexpected failures (DB errors, driver messages, stack traces) must never reach
// the client: they leak table names, query shapes and infrastructure details.
// Log the real reason server-side, hand the user a generic message.
function fail(res, err, context) {
  const detail = err instanceof Error ? err.stack || err.message : String(err);
  if (!isTest) {
    console.error(`[${context || 'api'}]`, detail);
  }
  return res.json({ success: false, error: GENERIC_ERROR });
}

module.exports = { fail, GENERIC_ERROR };
