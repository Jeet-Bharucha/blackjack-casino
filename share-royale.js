/* Invite friends to the free-play tables. No tracking or third-party scripts. */
async function shareRoyaleGame(button) {
  const url='https://blackjack-casino-inky.vercel.app/';
  const shareData={
    title:'Blackjack Casino Royale — Free Play',
    text:'Join me for free virtual-chip Blackjack! Ages 21+. No cash prizes.',
    url
  };
  if(navigator.share){
    try{await navigator.share(shareData);return;}
    catch(error){if(error?.name==='AbortError')return;}
  }
  try{
    await navigator.clipboard.writeText(url);
    if(button){
      const previous=button.textContent;
      button.textContent='✓ Link copied';
      setTimeout(()=>{if(button.isConnected)button.textContent=previous;},2200);
    }
  }catch{
    window.prompt('Copy your free-play Blackjack invitation:',url);
  }
}
