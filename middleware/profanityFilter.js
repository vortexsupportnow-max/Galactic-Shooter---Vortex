'use strict';

// Normalises a string to defeat common leet-speak / character substitutions
// before comparing against the banned-word list.
function normalise(text) {
  return text
    .toLowerCase()
    .replace(/4/g, 'a')
    .replace(/@/g, 'a')
    .replace(/3/g, 'e')
    .replace(/€/g, 'e')
    .replace(/1|!/g, 'i')
    .replace(/0/g, 'o')
    .replace(/5|\$/g, 's')
    .replace(/7/g, 't')
    .replace(/\+/g, 't')
    .replace(/8/g, 'b')
    .replace(/6/g, 'g')
    .replace(/9/g, 'g')
    .replace(/[-_.* ]/g, '');
}

// Banned words / roots (Italian and English).
// Words are matched as substrings inside the normalised nickname so that
// simple padding (e.g. "xxcazzoxx") is also caught.
const BANNED_WORDS = [
  // ── Italian profanity ──────────────────────────────────────────────────────
  'cazzo', 'cazz', 'kazzo',
  'minchia', 'minch',
  'figa', 'fica',
  'coglione', 'cogl',
  'stronzo', 'stronz',
  'bastardo', 'bastar',
  'puttana', 'puttan',
  'troia',
  'vaffanculo', 'vaffan', 'fanculo', 'vaffa',
  'merda',
  'porcodio', 'porcadio', 'porcamadonna', 'porcaeva',
  'porcamiseria', 'porco',
  'incesto', 'incest',
  'cornuto',
  'sfigato', 'sfiga',
  'cretino', 'cretin',
  'imbecille', 'imbecil',
  'idiota',
  'deficiente', 'defici',
  'ritardato', 'ritard',
  'scemo',
  'rincoglionito',
  'testa di cazzo',
  'figlio di puttana', 'figliodiputtana',
  'figliodibuttana',
  'vattafanculo',
  'mignotta',
  'baldracca',
  'escort', // used as insult in Italian slang
  'culattone',
  'frocio',
  'ricchione',
  'negro', 'negr',
  'terrone',
  'zingaro',
  'ebrea', 'ebreo',  // used as slurs in context
  // ── Italian blasphemy ──────────────────────────────────────────────────────
  'porcodio',
  'porcaeva',
  'dioporco',
  'diocane',
  'madonnac',       // madonnacc* root
  'porcamadonna',
  'porcaputt',
  'gesucrist',      // GesùCristo used as blasphemy
  'cristomaledett',
  // ── English profanity ──────────────────────────────────────────────────────
  'fuck', 'fck', 'fuk',
  'shit', 'sht',
  'bitch', 'btch',
  'cunt',
  'dick',
  'cock',
  'pussy',
  'asshole', 'arsehole',
  'bastard',
  'whore',
  'slut',
  'nigger', 'nigg', 'nigga',
  'faggot', 'fag',
  'retard',
  'motherfucker', 'mofo',
  'jackass',
  'dumbass',
  'dipshit',
  'wanker',
  'twat',
  'prick',
  'douche',
  'spic',
  'kike',
  'chink',
  'wetback',
  'cracker',
];

// De-duplicate and sort longest-first so more specific patterns are tried first
const BANNED_SORTED = [...new Set(BANNED_WORDS)].sort((a, b) => b.length - a.length);

/**
 * Returns true if `nickname` contains profanity, blasphemy, or slurs.
 * The check is case-insensitive and leet-speak aware.
 *
 * @param {string} nickname
 * @returns {boolean}
 */
function containsProfanity(nickname) {
  if (typeof nickname !== 'string') return false;
  const norm = normalise(nickname);
  return BANNED_SORTED.some(word => norm.includes(normalise(word)));
}

module.exports = { containsProfanity };
