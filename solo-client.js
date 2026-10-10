// Server-controlled single-player table. Results are never sent from this browser.
(() => {
  const root = 'https://blackjack-casino-nob6.onrender.com/api';
  let pending = false;
  let lastState = null;
  function setBusy(yes) {
    pending = yes;
    if(yes) ['dealBtn','hitBtn','standBtn','doubleBtn','splitBtn']
      .forEach(id => {const el=document.getElementById(id);if(el)el.disabled=true;});
  }
  async function send(path,body) {
    if(pending)return;
    setBusy(true);
    try {
      const res=await fetch(root+path,{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+localStorage.getItem('bj_token')},
        body:JSON.stringify(body)
      });
      const data=await res.json();
      if(!res.ok)throw Error(data.error||'Unable to play hand');
      updateTable(data);
      return data;
    } catch(error){
      showToast(error.message);
      try{await restore();}catch{}
    } finally{setBusy(false);refreshControls();}
  }
  function refreshControls() {
    if(pending)return;
    const st=lastState;
    if(!st||!st.active||st.phase==='finished'){
      enableBetting(true);return;
    }
    if(st.phase==='insurance'){
      enableBetting(false);
      document.getElementById('insuranceSub').textContent =
        'Dealer shows an Ace — Insurance costs $'+st.insuranceCost;
      document.getElementById('insuranceModal').classList.remove('hidden');
      return;
    }
    enableActions(!!st.canDouble,!!st.canSplit);
    document.getElementById('hitBtn').disabled=false;
    document.getElementById('standBtn').disabled=false;
  }
  function renderDealer(st) {
    const el=document.getElementById('dealerHand');
    el.querySelectorAll('.card-wrapper').forEach(card=>card.remove());
    st.dealerCards.forEach(card=>{
      const concealed=card.rank==='?';
      const wrapper=buildCardEl(concealed?{rank:'?',suit:'♠'}:card,concealed);
      wrapper.classList.remove('dealing');
      el.appendChild(wrapper);
    });
    const badge=document.getElementById('dealerScore');
    badge.textContent=handTotal(st.dealerCards.filter(c=>c.rank!=='?'));
    badge.style.display='';
  }
  function updateTable(st) {
    lastState=st;
    balance=st.balance;
    if(!st.active){gamePhase='bet';updateUI();refreshControls();return;}
    currentBet=st.baseBet;
    playerHands=st.hands;
    activeHandIdx=st.activeHand;
    dealerCards=st.dealerCards;
    gamePhase=st.phase==='finished'?'done':'player';
    updateUI();
    renderPlayerHands();
    renderDealer(st);
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
    if(st.active)updateTable(st);
    else { lastState=st; balance=st.balance;gamePhase='bet';updateUI();refreshControls(); }
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
  restore().catch(e=>showToast(e.message));
})();
