// Server-controlled single-player table. Results are never sent from this browser.
(() => {
  const root = 'https://blackjack-casino-nob6.onrender.com/api';
  let pending = false;
  let lastState = null;
  function setBusy(yes) {
    pending = yes;
    window.bjBusy = yes;
    document.body.classList.toggle('game-pending', yes);
    document.querySelectorAll('#chipsRow .chip').forEach(chip => {
      if (yes) { chip.classList.add('disabled'); chip.disabled = true; }
    });
    if(yes) ['dealBtn','hitBtn','standBtn','doubleBtn','splitBtn']
      .forEach(id => {const el=document.getElementById(id);if(el)el.disabled=true;});
  }
  async function send(path,body) {
    if(pending)return;
    setBusy(true);
    const waitNotice=setTimeout(()=>setStatus('Connecting to the table…'),3200);
    try {
      const res=await fetch(root+path,{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+localStorage.getItem('bj_token')},
        body:JSON.stringify(body)
      });
      const data=await res.json();
      if(!res.ok)throw Error(data.error||'Unable to play hand');
      await updateTable(data, {animate: true});
      return data;
    } catch(error){
      showToast(error.message);
      try{await restore();}catch{}
    } finally{setBusy(false);clearTimeout(waitNotice);refreshControls();}
  }
  function refreshControls() {
    if(pending)return;
    const st=lastState;
    if(!st||!st.active){enableBetting(!!balance);return;}
    if(st.phase==='finished'){enableBetting(false);return;}
    if(st.phase==='insurance'){
      enableBetting(false);
      document.getElementById('insuranceSub').textContent =
        'Dealer shows an Ace — Insurance costs '+st.insuranceCost+' chips';
      document.getElementById('insuranceModal').classList.remove('hidden');
      return;
    }
    enableActions(!!st.canDouble,!!st.canSplit);
    document.getElementById('hitBtn').disabled=false;
    document.getElementById('standBtn').disabled=false;
  }
  // Server returns the whole dealt hand at once, but the player should see
  // cards leave the shoe ONE AT A TIME, like the original animated table.
  // This is presentation only: cards and payouts still come from the backend.
  const pause = ms => {
    const reduced=document.body.classList.contains('reduce-motion') ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return new Promise(resolve => setTimeout(resolve, reduced ? 20 : ms));
  };

  function renderDealer(st) {
    const el=document.getElementById('dealerHand');
    el.querySelectorAll('.card-wrapper').forEach(card=>card.remove());
    st.dealerCards.forEach(card=>{
      const concealed=card.rank==='?';
      const wrapper=buildCardEl(concealed?{rank:'?',suit:'♠'}:card,concealed);
      wrapper.classList.remove('dealing');
      wrapper.style.animation='none'; // Restored/unchanged cards must not re-deal.
      el.appendChild(wrapper);
    });
    const badge=document.getElementById('dealerScore');
    badge.textContent=handTotal(st.dealerCards.filter(c=>c.rank!=='?'));
    badge.style.display='';
  }

  // The initial sequence is player, dealer, player, dealer (face-down).
  // Keep all action buttons disabled until the four cards have arrived.
  async function dealOpeningCards(st) {
    const row=document.getElementById('handsRow');
    row.replaceChildren();
    const dealerHand=document.getElementById('dealerHand');
    dealerHand.querySelectorAll('.card-wrapper').forEach(card=>card.remove());
    const dealerScore=document.getElementById('dealerScore');
    dealerScore.style.display='none';

    const group=document.createElement('div');
    group.className='hand-group';
    const playerHand=document.createElement('div');
    playerHand.className='hand active-hand';
    playerHand.id='playerHand0';
    const score=document.createElement('span');
    score.className='score-badge';
    score.id='playerScore0';
    score.style.display='none';
    playerHand.appendChild(score);
    group.appendChild(playerHand);
    row.appendChild(group);

    setStatus('Dealing cards...');
    await addCardToEl(playerHand, st.hands[0].cards[0]);
    await addCardToEl(dealerHand, st.dealerCards[0]);
    await addCardToEl(playerHand, st.hands[0].cards[1]);
    // Only the back of the dealer's hole card is visible before settlement.
    const hole=st.dealerCards[1] || {rank:'?',suit:'?'};
    await addCardToEl(dealerHand, hole, true);

    updateHandEl(playerHand,st.hands[0].cards);
    dealerScore.textContent=handTotal([st.dealerCards[0]]);
    dealerScore.style.display='';
  }

  // Reveal the dealer's hole card and any additional hits in order. This also
  // works if the backend resolves a natural Blackjack on the initial deal.
  async function showDealerSettlement(st,alreadyDealt=false) {
    const el=document.getElementById('dealerHand');
    const dealerScore=document.getElementById('dealerScore');
    let hole;
    if(alreadyDealt) {
      hole=el.querySelectorAll('.card-wrapper')[1];
    } else {
      el.querySelectorAll('.card-wrapper').forEach(card=>card.remove());
      for(let i=0;i<Math.min(2,st.dealerCards.length);i++){
        const card=buildCardEl(st.dealerCards[i],i===1);
        card.classList.remove('dealing');
        card.style.animation='none';
        el.appendChild(card);
      }
      hole=el.querySelectorAll('.card-wrapper')[1];
      dealerScore.textContent=handTotal(st.dealerCards.slice(0,1));
      dealerScore.style.display='';
    }
    if(hole){
      await pause(220);
      await flipCard(hole);
      dealerScore.textContent=handTotal(st.dealerCards.slice(0,2));
    }
    for(let i=2;i<st.dealerCards.length;i++){
      await addCardToEl(el,st.dealerCards[i]);
      dealerScore.textContent=handTotal(st.dealerCards.slice(0,i+1));
    }
  }

  // Restore and unchanged cards render immediately. Newly drawn cards on Hit,
  // Double or Split receive an appearance animation, but are never re-dealt.
  function renderPlayerState(st,previous,animate) {
    renderPlayerHands();
    document.querySelectorAll('#handsRow .hand-group').forEach((group,i)=>{
      const previousCount=previous && st.hands.length===previous.hands.length
        ? (previous.hands[i]?.cards.length || 0) : 0;
      group.querySelectorAll('.card-wrapper').forEach((card,j)=>{
        card.style.animation='none';
        if(animate && previous && j>=previousCount){
          const offset=(i*2+j-previousCount)*170;
          card.style.animation='verifiedDeal .38s cubic-bezier(.2,.8,.2,1) both';
          card.style.animationDelay=offset+'ms';
          playTone('deal');
        }
      });
    });
  }

  async function updateTable(st,{animate=false}={}) {
    const previous=lastState?.roundId===st.roundId ? lastState : null;
    lastState=st;
    balance=st.balance;
    if(!st.active){gamePhase='bet';updateUI();refreshControls();return;}
    currentBet=st.baseBet;
    playerHands=st.hands;
    activeHandIdx=st.activeHand;
    dealerCards=st.dealerCards;
    gamePhase=st.phase==='finished'?'done':'player';
    updateUI();

    const openingDeal=animate && !previous && st.hands.length===1
      && st.hands[0].cards.length>=2 && st.dealerCards.length>=2;
    if(openingDeal) {
      await dealOpeningCards(st);
      if(st.phase==='finished') await showDealerSettlement(st,true);
    } else {
      renderPlayerState(st,previous,animate);
      if(animate && previous && st.phase==='finished' && previous.phase!=='finished')
        await showDealerSettlement(st);
      else renderDealer(st);
    }

    document.getElementById('insuranceModal').classList.toggle('hidden',st.phase!=='insurance');
    if(st.phase==='finished'&&st.outcome){
      const out=st.outcome,won=out.net>0;
      const cls=won?'win':out.net<0?'lose':'push';
      const title=out.result==='blackjack'?'Blackjack!':won?'You Win!':out.net<0?'Dealer Wins':'Push';
      showResultPopup(cls,title,out.hands.length>1?'Split round completed':('Dealer has '+handTotal(st.dealerCards)),out.net);
      playTone(won?'win':'lose');
      if(won){spawnConfetti();triggerWinAnimation();}
      setStatus('Round complete — next hand?');
      window.dispatchEvent(new Event('bj:round-complete'));
      loadUser();
    }else if(st.phase==='insurance') setStatus('Dealer has an Ace — choose insurance');
    else setStatus('Your move — hit, stand, double, or split');
    refreshControls();
  }
  async function restore(){
    const token=localStorage.getItem('bj_token');
    if(!token)return;
    const res=await fetch(root+'/solo/state',{headers:{Authorization:'Bearer '+token}});
    if(!res.ok)throw Error('Unable to restore your game');
    const st=await res.json();
    if(st.active)await updateTable(st);
    else { lastState=st; balance=st.balance;gamePhase='bet';currentBet=0;updateUI();refreshControls(); }
  }
  window.startDeal=async function(){
    if(pending||gamePhase!=='bet'||!Number.isInteger(currentBet)||currentBet<1)return;
    if(audioCtx.state==='suspended')audioCtx.resume();
    document.getElementById('resultPopup').classList.remove('show');
    await send('/solo/start',{bet:currentBet});
  };
  window.hit=async()=>send('/solo/action',{action:'hit'});
  window.stand=async()=>send('/solo/action',{action:'stand'});
  window.doubleDown=async()=>send('/solo/action',{action:'double'});
  window.split=async()=>send('/solo/action',{action:'split'});
  window.takeInsurance=async function(yes){
    await send('/solo/action',{action:yes?'insurance_yes':'insurance_no'});
  };
  window.nextRound=function(){
    if(pending)return;
    document.getElementById('resultPopup').classList.remove('show');
    setTimeout(()=>document.getElementById('resultPopup').classList.add('hidden'),400);
    lastState=null;
    currentBet=0;gamePhase='bet';playerHands=[];dealerCards=[];
    document.getElementById('dealerHand').querySelectorAll('.card-wrapper').forEach(el=>el.remove());
    document.getElementById('handsRow').innerHTML='';
    document.getElementById('dealerScore').style.display='none';
    updateUI();
    if(!balance)showToast('Out of chips — collect a free daily bonus tomorrow.');
    enableBetting(!!balance);
    setStatus('Place your bet and deal');
  };
  // Legacy client-authoritative result endpoints are disabled by the backend.
  window.saveResult=async()=>{};
  restore().catch(e=>{
    showToast('Could not load the table. Check your connection, then refresh.');
    setStatus('Connection unavailable — refresh to retry');
  });
})();
