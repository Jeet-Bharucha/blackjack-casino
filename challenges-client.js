(() => {
  const api='https://blackjack-casino-nob6.onrender.com/api';
  const panel=document.getElementById('challengePanel');
  const content=document.getElementById('challengeContent');
  window.toggleChallengePanel=()=>{
    panel.classList.toggle('hidden');
    if(!panel.classList.contains('hidden'))loadChallenges();
  };
  async function loadChallenges(){
    content.textContent='Loading your challenges...';
    try {
      const response=await fetch(api+'/challenges',{headers:{Authorization:'Bearer '+localStorage.getItem('bj_token')}});
      if(!response.ok)throw Error('Unable to load challenges');
      const data=await response.json();
      content.replaceChildren();
      const note=document.createElement('p');
      note.textContent='UTC daily reset · trusted solo rounds only · chip prizes are virtual';
      note.className='challenge-note';content.appendChild(note);
      for(const c of data.challenges){
        const row=document.createElement('div');row.className='challenge-row';
        const title=document.createElement('div');title.className='challenge-label';
        title.textContent=c.label+' ('+c.progress+'/'+c.target+')';
        const btn=document.createElement('button');btn.type='button';
        btn.textContent=c.claimed?'✓ Claimed':('Claim '+c.reward+' chips');
        btn.disabled=c.claimed||c.progress<c.target;
        btn.addEventListener('click',async()=>{
          btn.disabled=true;
          try {
            const res=await fetch(api+'/challenges/claim',{method:'POST',
              headers:{'Content-Type':'application/json',Authorization:'Bearer '+localStorage.getItem('bj_token')},
              body:JSON.stringify({key:c.key})});
            const result=await res.json();
            if(!res.ok)throw Error(result.error||'Could not claim reward');
            balance=result.balance;updateUI();showToast('+'+result.added+' bonus chips!');
            await loadChallenges();
          }catch(e){showToast(e.message);btn.disabled=false;}
        });
        row.append(title,btn);content.appendChild(row);
      }
    }catch(error){content.textContent=error.message;}
  }
  window.addEventListener('bj:round-complete',()=>{
    if(!panel.classList.contains('hidden'))loadChallenges();
  });
})();
