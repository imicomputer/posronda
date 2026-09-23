// Unit tests for the pure Svelte UI helpers.
// Run: npm test
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { colorOf, fmtTime, typingText, pruneTyping, TYPING_TTL } from '../src/lib/ui.js';

describe('colorOf', () => {
  it('is stable per username', () => {
    assert.equal(colorOf('alice'), colorOf('alice'));
  });
  it('differs between usernames', () => {
    assert.notEqual(colorOf('alice'), colorOf('bob'));
  });
  it('returns an hsl() color string', () => {
    assert.match(colorOf('alice'), /^hsl\(\d+ 65% 55%\)$/);
  });
});

describe('fmtTime', () => {
  it('formats a timestamp as HH:MM', () => {
    assert.match(fmtTime(Date.now()), /^\d{1,2}:\d{2}/);
  });
});

describe('typingText', () => {
  it('returns empty for nobody typing', () => {
    assert.equal(typingText([]), '');
  });
  it('names a single typist', () => {
    assert.equal(typingText(['alice']), 'alice is typing…');
  });
  it('names two typists', () => {
    assert.equal(typingText(['alice', 'bob']), 'alice and bob are typing…');
  });
  it('collapses three or more typists', () => {
    assert.equal(typingText(['a', 'b', 'c']), 'Several people are typing…');
  });
});

describe('pruneTyping', () => {
  it('drops entries older than TYPING_TTL', () => {
    const now = 100000;
    const out = pruneTyping({ alice: now, bob: now - TYPING_TTL - 1 }, now);
    assert.deepEqual(out, { alice: now });
  });
  it('keeps fresh entries and exposes the TTL', () => {
    assert.equal(typeof TYPING_TTL, 'number');
    const now = Date.now();
    assert.deepEqual(pruneTyping({ alice: now }, now), { alice: now });
  });
});
