'use strict';

const { containsProfanity } = require('../../middleware/profanityFilter');

describe('containsProfanity', () => {
  // ── Clean nicknames ─────────────────────────────────────────────────────────
  it('returns false for a clean nickname', () => {
    expect(containsProfanity('StarPilot')).toBe(false);
  });

  it('returns false for a nickname with numbers that are not leet-speak for a banned word', () => {
    expect(containsProfanity('Pilot42')).toBe(false);
  });

  it('returns false for a short clean nickname', () => {
    expect(containsProfanity('AceX')).toBe(false);
  });

  it('returns false for non-string input', () => {
    expect(containsProfanity(null)).toBe(false);
    expect(containsProfanity(undefined)).toBe(false);
    expect(containsProfanity(123)).toBe(false);
  });

  // ── Italian profanity ────────────────────────────────────────────────────────
  it('detects Italian profanity: cazzo (exact)', () => {
    expect(containsProfanity('cazzo')).toBe(true);
  });

  it('detects Italian profanity: cazzo (mixed case)', () => {
    expect(containsProfanity('CaZzO')).toBe(true);
  });

  it('detects Italian profanity: cazzo (leet-speak c4zz0)', () => {
    expect(containsProfanity('c4zz0')).toBe(true);
  });

  it('detects Italian profanity: embedded in a nickname (xxcazzoxx)', () => {
    expect(containsProfanity('xxcazzoxx')).toBe(true);
  });

  it('detects Italian profanity: minchia', () => {
    expect(containsProfanity('minchia99')).toBe(true);
  });

  it('detects Italian profanity: stronzo', () => {
    expect(containsProfanity('stronzo')).toBe(true);
  });

  it('detects Italian profanity: merda', () => {
    expect(containsProfanity('MerdaGamer')).toBe(true);
  });

  it('detects Italian profanity: vaffanculo', () => {
    expect(containsProfanity('vaffanculo')).toBe(true);
  });

  it('detects Italian profanity: puttana', () => {
    expect(containsProfanity('puttana')).toBe(true);
  });

  it('detects Italian profanity: figa', () => {
    expect(containsProfanity('figa')).toBe(true);
  });

  it('detects Italian profanity: idiota', () => {
    expect(containsProfanity('idiota')).toBe(true);
  });

  // ── Italian blasphemy ────────────────────────────────────────────────────────
  it('detects Italian blasphemy: porcodio', () => {
    expect(containsProfanity('porcodio')).toBe(true);
  });

  it('detects Italian blasphemy: porcamadonna', () => {
    expect(containsProfanity('porcamadonna')).toBe(true);
  });

  it('detects Italian blasphemy: dioporco', () => {
    expect(containsProfanity('dioporco')).toBe(true);
  });

  // ── English profanity ─────────────────────────────────────────────────────
  it('detects English profanity: fuck', () => {
    expect(containsProfanity('fuck')).toBe(true);
  });

  it('detects English profanity: f**k via leet-speak (fuk)', () => {
    expect(containsProfanity('FuK_Player')).toBe(true);
  });

  it('detects English profanity: shit', () => {
    expect(containsProfanity('ShitGamer')).toBe(true);
  });

  it('detects English profanity: bitch', () => {
    expect(containsProfanity('bitch')).toBe(true);
  });

  it('detects English profanity: cunt', () => {
    expect(containsProfanity('cunt')).toBe(true);
  });

  it('detects English profanity: nigger', () => {
    expect(containsProfanity('nigger')).toBe(true);
  });

  it('detects English profanity: nigga (common variant)', () => {
    expect(containsProfanity('nigga')).toBe(true);
  });

  it('detects English profanity: faggot', () => {
    expect(containsProfanity('faggot')).toBe(true);
  });

  // ── Leet-speak detection ─────────────────────────────────────────────────
  it('detects leet-speak: $h1t → shit', () => {
    expect(containsProfanity('$h1t')).toBe(true);
  });

  it('detects leet-speak: fUcK with uppercase', () => {
    expect(containsProfanity('fUcK')).toBe(true);
  });

  it('detects leet-speak: st4r (clean word, not banned)', () => {
    expect(containsProfanity('st4r')).toBe(false);
  });
});
