'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const client = readFileSync(join(__dirname, '../../solo-client.js'), 'utf8');
const start = client.indexOf('  async function dealOpeningCards(st) {');
const end = client.indexOf("  // Reveal the dealer's hole card", start);
assert.ok(start >= 0 && end > start, 'Opening deal handler should exist');
const handlerCode = client.slice(start, end);

test('new rounds deal player, dealer, player, hidden dealer in strict sequence', async () => {
  const dealt = [];
  class NodeStub {
    constructor(id) {
      this.id = id || '';
      this.children = [];
      this.style = {};
      this.className = '';
    }
    replaceChildren() { this.children = []; }
    appendChild(node) { this.children.push(node); return node; }
    querySelectorAll() { return []; }
  }
  const elements = new Map(['handsRow', 'dealerHand', 'dealerScore']
    .map(id => [id, new NodeStub(id)]));
  const document = {
    getElementById(id) { return elements.get(id); },
    createElement() { return new NodeStub(); }
  };
  const addCardToEl = async (hand, card, hidden = false) => {
    dealt.push([hand.id, card.rank, hidden]);
    await new Promise(resolve => setImmediate(resolve));
  };
  const getHandler = new Function(
    'document', 'setStatus', 'addCardToEl', 'updateHandEl', 'handTotal',
    handlerCode + '\nreturn dealOpeningCards;'
  );
  const dealOpeningCards = getHandler(document, () => {}, addCardToEl, () => {}, cards => cards.length * 10);
  await dealOpeningCards({
    hands: [{ cards: [{ rank: '3', suit: '♥' }, { rank: '10', suit: '♣' }] }],
    dealerCards: [{ rank: '8', suit: '♦' }, { rank: '?', suit: '?' }]
  });
  assert.deepEqual(dealt, [
    ['playerHand0', '3', false],
    ['dealerHand', '8', false],
    ['playerHand0', '10', false],
    ['dealerHand', '?', true]
  ]);
});

test('opening animation completes before action controls are unlocked', () => {
  assert.match(client, /await updateTable\(data, \{animate: true\}\)/);
  assert.match(client, /finally\s*\{\s*setBusy\(false\)/);
  assert.match(client, /if\(st\.active\)await updateTable\(st\)/); // Restore stays instant.
});
