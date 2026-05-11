(function () {
  if (localStorage.getItem('cookie_consent') === 'accepted') return;

  var style = document.createElement('style');
  style.textContent = [
    '#cj-banner{',
      'position:fixed;bottom:0;left:0;right:0;z-index:9999;',
      'background:rgba(10,5,0,0.97);',
      'border-top:1px solid rgba(255,215,100,0.2);',
      'padding:14px 24px;',
      'display:flex;align-items:center;gap:16px;flex-wrap:wrap;',
      'transform:translateY(100%);transition:transform 0.4s cubic-bezier(0.2,0.8,0.4,1);',
      'font-family:"Cinzel",Georgia,serif;',
    '}',
    '#cj-banner.visible{transform:translateY(0);}',
    '#cj-text{',
      'flex:1;min-width:220px;',
      'font-size:12px;color:rgba(255,255,255,0.55);',
      'font-family:"Crimson Text",Georgia,serif;',
      'line-height:1.5;',
    '}',
    '#cj-text span.cj-suit{color:rgba(255,215,100,0.6);margin-right:6px;font-family:serif;}',
    '#cj-learn{',
      'font-size:10px;letter-spacing:2px;color:rgba(255,215,100,0.5);',
      'text-decoration:none;transition:color 0.2s;white-space:nowrap;',
      'font-family:"Cinzel",serif;',
    '}',
    '#cj-learn:hover{color:#ffd764;}',
    '#cj-accept{',
      'padding:9px 22px;',
      'background:linear-gradient(135deg,#c9a227,#ffd764,#c9a227);',
      'color:#1a0a00;border:none;border-radius:5px;',
      'font-family:"Cinzel",serif;font-size:10px;font-weight:700;letter-spacing:2px;',
      'cursor:pointer;white-space:nowrap;',
      'box-shadow:0 3px 10px rgba(201,162,39,0.3);',
      'transition:transform 0.15s,box-shadow 0.15s;',
    '}',
    '#cj-accept:hover{transform:translateY(-1px);box-shadow:0 5px 14px rgba(201,162,39,0.45);}',
  ].join('');
  document.head.appendChild(style);

  var banner = document.createElement('div');
  banner.id = 'cj-banner';
  banner.innerHTML =
    '<div id="cj-text"><span class="cj-suit">♠</span>We use cookies and localStorage to keep you logged in and remember your preferences.</div>' +
    '<a id="cj-learn" href="privacy.html">Learn More</a>' +
    '<button id="cj-accept">Accept</button>';
  document.body.appendChild(banner);

  // Slide up after a brief delay
  setTimeout(function () { banner.classList.add('visible'); }, 200);

  document.getElementById('cj-accept').addEventListener('click', function () {
    localStorage.setItem('cookie_consent', 'accepted');
    banner.classList.remove('visible');
    setTimeout(function () { banner.remove(); }, 450);
  });
})();
