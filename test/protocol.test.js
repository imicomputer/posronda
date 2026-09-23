// Unit tests for the shared protocol helpers.
// Run: npm test
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validUsername, normalizeName, isTaken, sanitizeChat, isTypingMessage } from '../lib/protocol.js';

describe('validUsername', () => {
  it('accepts normal names', () => {
    assert.equal(validUsername('alice'), true);
    assert.equal(validUsername('bob_123-x'), true);
    assert.equal(validUsername('  svelte_fan  '), true); // surrounding spaces trimmed
  });
  it('rejects too short / empty / missing', () => {
    assert.equal(validUsername('a'), false);
    assert.equal(validUsername(''), false);
    assert.equal(validUsername('   '), false);
    assert.equal(validUsername(null), false);
    assert.equal(validUsername(undefined), false);
  });
  it('rejects illegal characters', () => {
    assert.equal(validUsername('alice!'), false);
    assert.equal(validUsername('bo b'), false);
    assert.equal(validUsername('hacker;drop'), false);
  });
  it('caps overlong input at 20 chars instead of rejecting', () => {
    assert.equal(validUsername('a'.repeat(25)), true);
    assert.equal(normalizeName('a'.repeat(25)).length, 20);
  });
});

describe('isTaken', () => {
  it('detects duplicates case-insensitively', () => {
    assert.equal(isTaken(['alice', 'Bob'], 'ALICE'), true);
    assert.equal(isTaken(['alice', 'Bob'], 'bob'), true);
    assert.equal(isTaken(['alice', null], 'carol'), false);
  });
  it('ignores empty slots', () => {
    assert.equal(isTaken([null, null], 'alice'), false);
  });
});

describe('sanitizeChat', () => {
  it('trims whitespace', () => {
    assert.equal(sanitizeChat('  hi  '), 'hi');
  });
  it('returns empty for blank input (nothing to relay)', () => {
    assert.equal(sanitizeChat('   '), '');
    assert.equal(sanitizeChat(null), '');
  });
  it('caps messages at 500 chars', () => {
    assert.equal(sanitizeChat('x'.repeat(600)).length, 500);
  });
});

describe('isTypingMessage', () => {
  it('accepts boolean typing flags', () => {
    assert.equal(isTypingMessage({ type: 'typing', typing: true }), true);
    assert.equal(isTypingMessage({ type: 'typing', typing: false }), true);
  });
  it('rejects non-boolean / missing typing flags', () => {
    assert.equal(isTypingMessage({ type: 'typing' }), false);
    assert.equal(isTypingMessage({ type: 'typing', typing: 'yes' }), false);
    assert.equal(isTypingMessage({ type: 'typing', typing: 1 }), false);
    assert.equal(isTypingMessage({ type: 'typing', typing: null }), false);
  });
  it('rejects wrong type / missing payload', () => {
    assert.equal(isTypingMessage({ type: 'chat', typing: true }), false);
    assert.equal(isTypingMessage(null), false);
    assert.equal(isTypingMessage(undefined), false);
  });
});
