// Unit tests for the pure Svelte UI helpers.
// Run: npm test
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { colorOf, fmtTime } from '../src/lib/ui.js';

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
