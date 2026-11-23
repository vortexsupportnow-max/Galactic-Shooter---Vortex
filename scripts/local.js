'use strict';

// Play on localhost without Supabase:
//   npm run local          → empty local database (db/local-data.json)
//   npm run local:rich     → new accounts start with 1,000,000 coins / 100,000 gems
//   npm run local:reset    → wipe the local database first
//
// Works the same on Windows, macOS and Linux (no shell env syntax needed).

const fs = require('fs');
const path = require('path');

process.env.DB_MODE = 'local';
process.env.NODE_ENV = 'development'; // even if .env says production
if (process.argv.includes('--rich')) process.env.LOCAL_RICH = '1';

const file = process.env.LOCAL_DB_FILE || path.join(__dirname, '..', 'db', 'local-data.json');
if (process.argv.includes('--reset') && fs.existsSync(file)) {
  fs.unlinkSync(file);
  console.log('Local database wiped.');
}

require('../server');

const port = process.env.PORT || 3000;
setTimeout(() => {
  console.log(`\n  Galactic Shooter (local) → http://localhost:${port}\n` +
    (process.env.LOCAL_RICH === '1' ? '  New accounts start rich (1,000,000 coins, 100,000 gems).\n' : ''));
}, 300);
