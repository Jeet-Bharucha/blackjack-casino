const test = require('node:test');
const assert = require('node:assert/strict');
const blackjack = require('../solo-engine');

test('round snapshots conceal the dealer hole card', () => {
  const round=blackjack.create(50);
  if(round.phase!=='finished'){
    const visible=blackjack.view(round,500);
    assert.equal(visible.dealerCards[1].rank,'?');
    assert.equal(visible.hands.length,1);
    assert.equal(visible.baseBet,50);
  }
});
test('invalid betting amounts and actions are rejected', () => {
  for(const invalid of [0,-4,1.5,NaN,Infinity,'500',100001]) {
    assert.throws(()=>blackjack.create(invalid));
  }
  const round=blackjack.create(50);
  if(round.phase==='insurance') {
    assert.throws(()=>blackjack.play(round,'hit',500));
    blackjack.play(round,'insurance_no',500);
  }
  if(round.phase==='playing')assert.throws(()=>blackjack.play(round,'free_money',500));
});
test('server settles legitimate rounds without paying more than allowed', () => {
  for(let i=0;i<400;i++) {
    const round=blackjack.create(20);
    let steps=0;
    while(round.phase!=='finished'&&steps++<40) {
      if(round.phase==='insurance')blackjack.play(round,'insurance_no',500);
      else blackjack.play(round,steps%4===0?'hit':'stand',500);
    }
    assert.equal(round.phase,'finished');
    assert.ok(round.outcome);
    assert.ok(round.outcome.payout>=0);
    assert.ok(round.outcome.payout<=100);
    assert.equal(round.outcome.net,round.outcome.payout-round.outcome.stake);
    assert.throws(()=>blackjack.play(round,'stand',500));
  }
});
test('insurance, splitting and doubling cannot spend more than available', () => {
  for(let i=0;i<400;i++){
    const g=blackjack.create(100);
    if(g.phase==='insurance'){
      assert.throws(()=>blackjack.play(g,'insurance_yes',0));
      blackjack.play(g,'insurance_no',0);
    }
    if(g.phase==='playing') {
      assert.throws(()=>blackjack.play(g,'double',0));
      if(g.hands[0].cards.length===2 && g.hands[0].cards[0].rank===g.hands[0].cards[1].rank) {
        assert.throws(()=>blackjack.play(g,'split',0));
      }
    }
  }
});
