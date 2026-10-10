'use strict';
const { randomInt, randomUUID } = require('crypto');
const SUITS = ['♠','♥','♦','♣'];
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const cardValue = rank => rank === 'A' ? 11 : ['J','Q','K'].includes(rank) ? 10 : Number(rank);
function total(cards) {
  let sum = 0, aces = 0;
  for (const c of cards) { sum += cardValue(c.rank); if (c.rank === 'A') aces++; }
  while (sum > 21 && aces--) sum -= 10;
  return sum;
}
function newShoe() {
  const deck = [];
  for (let d=0; d<6; d++) for(const suit of SUITS) for(const rank of RANKS) deck.push({rank,suit});
  for(let i=deck.length-1; i>0; i--) {
    const j=randomInt(i+1); [deck[i],deck[j]]=[deck[j],deck[i]];
  }
  return deck;
}
function draw(g) {
  if(g.shoe.length===0) g.shoe=newShoe();
  return g.shoe.pop();
}
function isNatural(cards) { return cards.length===2 && total(cards)===21; }
function create(bet) {
  if(!Number.isSafeInteger(bet) || bet<1 || bet>100000)
    throw new Error('Bet must be a whole number from 1 to 100,000.');
  const g={ id:randomUUID(),shoe:newShoe(),dealer:[],hands:[{cards:[],bet,done:false,doubled:false}],active:0,baseBet:bet,stake:bet,insuranceBet:0,phase:'playing',created:Date.now() };
  g.hands[0].cards.push(draw(g),draw(g));
  g.dealer.push(draw(g),draw(g));
  const dealerNatural=isNatural(g.dealer);
  if(g.dealer[0].rank==='A') g.phase='insurance';
  else if(dealerNatural || isNatural(g.hands[0].cards)) finish(g);
  return g;
}
function next(g) {
  const nextIndex=g.hands.findIndex((h,i)=>i>g.active&&!h.done);
  if(nextIndex>=0){g.active=nextIndex;return;}
  finish(g);
}
function play(g,action,availableBalance=0){
  if(g.phase==='finished') throw new Error('This round has already finished.');
  let extraStake=0;
  if(g.phase==='insurance'){
    if(action!=='insurance_yes' && action!=='insurance_no') throw new Error('Choose whether to take insurance.');
    if(action==='insurance_yes'){
      const amount=Math.floor(g.baseBet/2);
      if(!amount || amount>availableBalance)throw new Error('Not enough chips for insurance.');
      extraStake=amount;g.stake+=amount;g.insuranceBet=amount;
    }
    if(isNatural(g.dealer)||isNatural(g.hands[0].cards)) finish(g);
    else g.phase='playing';
    return extraStake;
  }
  if(g.phase!=='playing')throw new Error('Round is not active.');
  const h=g.hands[g.active];
  if(!h||h.done)throw new Error('That hand is finished.');
  switch(action){
    case 'hit':
      h.cards.push(draw(g));
      if(total(h.cards)>=21){h.done=true;next(g);}
      break;
    case 'stand':
      h.done=true;next(g);break;
    case 'double':
      if(h.cards.length!==2 || h.bet>availableBalance)throw new Error('Cannot double this hand.');
      extraStake=h.bet;g.stake+=extraStake;h.bet*=2;h.doubled=true;
      h.cards.push(draw(g));h.done=true;next(g);break;
    case 'split':{
      if(g.hands.length!==1 || h.cards.length!==2 || cardValue(h.cards[0].rank)!==cardValue(h.cards[1].rank))
        throw new Error('This hand cannot be split.');
      if(h.bet>availableBalance)throw new Error('Not enough chips to split.');
      extraStake=h.bet;g.stake+=extraStake;
      const [first,second]=h.cards;
      g.hands=[{cards:[first,draw(g)],bet:h.bet,done:false,doubled:false},
               {cards:[second,draw(g)],bet:h.bet,done:false,doubled:false}];
      g.active=0;break;
    }
    default: throw new Error('Unknown action.');
  }
  return extraStake;
}
function finish(g){
  if(g.phase==='finished') return g.outcome;
  const dealerBJ=isNatural(g.dealer);
  const playable=g.hands.some(h=>total(h.cards)<=21);
  if(playable&&!dealerBJ)while(total(g.dealer)<17)g.dealer.push(draw(g));
  const dt=total(g.dealer);let payout=0,wins=0,losses=0;
  const hands=g.hands.map(h=>{
    const t=total(h.cards), natural=g.hands.length===1&&isNatural(h.cards);
    let result,paid;
    if(t>21){result='bust';paid=0;}
    else if(dealerBJ){result=natural?'push':'lose';paid=natural?h.bet:0;}
    else if(natural){result='blackjack';paid=Math.floor(h.bet*2.5);}
    else if(dt>21){result='dealer_bust';paid=h.bet*2;}
    else if(t>dt){result=h.doubled?'double_win':'win';paid=h.bet*2;}
    else if(t===dt){result='push';paid=h.bet;}
    else{result='lose';paid=0;}
    if(['blackjack','dealer_bust','double_win','win'].includes(result))wins++;
    if(['bust','lose'].includes(result))losses++;
    payout+=paid;
    return {result,payout:paid,bet:h.bet,handTotal:t};
  });
  if(g.insuranceBet && dealerBJ) payout+=g.insuranceBet*3;
  const overall=g.hands.length>1 ? (wins===g.hands.length?'split_win':losses===g.hands.length?'lose':'push') : hands[0].result;
  g.outcome={result:overall, hands, payout, stake:g.stake, net:payout-g.stake,
    playerHand:g.hands.map(h=>h.cards.map(c=>c.rank+c.suit).join(' ')).join(' | '),
    dealerHand:g.dealer.map(c=>c.rank+c.suit).join(' ')};
  g.phase='finished';
  return g.outcome;
}
function view(g,balance){
  const done=g.phase==='finished';
  const hand=g.hands[g.active];
  return {active:true,roundId:g.id,phase:g.phase,baseBet:g.baseBet,balance,
    hands:g.hands.map(h=>({cards:h.cards,bet:h.bet,done:h.done,doubled:h.doubled})),
    dealerCards:done ? g.dealer : [g.dealer[0],{rank:'?',suit:'?'}],
    activeHand:g.active,insuranceCost:Math.floor(g.baseBet/2),
    canDouble:g.phase==='playing'&&!!hand&&!hand.done&&hand.cards.length===2&&balance>=hand.bet,
    canSplit:g.phase==='playing'&&g.hands.length===1&&hand?.cards.length===2&&
      cardValue(hand.cards[0].rank)===cardValue(hand.cards[1].rank)&&balance>=hand.bet,
    outcome:done?g.outcome:null };
}
module.exports={create,play,view,total};
