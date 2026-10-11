/* Presentation and accessibility helpers for the free-play Blackjack table.
   Never determines cards, odds, wins, payouts or account balances. */
(() => {
  'use strict';
  const panel = document.getElementById('luxuryHelpPanel');
  const close = document.getElementById('closeLuxuryHelp');
  const volume = document.getElementById('luxuryVolume');
  const volumeLabel = document.getElementById('luxuryVolumeLabel');
  const reduceMotion = document.getElementById('luxuryReduceMotion');
  let previousFocus = null;

  const storedVolume = localStorage.getItem('bj_volume');
  const numericVolume = storedVolume === null ? 55 : Number(storedVolume) * 100;
  const initialVolume = Number.isFinite(numericVolume)
    ? Math.max(0, Math.min(100, Math.round(numericVolume))) : 55;
  volume.value = String(initialVolume);
  volumeLabel.textContent = initialVolume + '%';

  volume.addEventListener('input', () => {
    const value = Math.max(0, Math.min(100, Number(volume.value) || 0));
    setCasinoVolume(value / 100);
    volumeLabel.textContent = value + '%';
  });

  function setMotionPreference(enabled) {
    const reduced = !!enabled;
    localStorage.setItem('bj_reduce_motion', reduced ? '1' : '0');
    document.body.classList.toggle('reduce-motion', reduced);
    reduceMotion.checked = reduced;
  }
  setMotionPreference(localStorage.getItem('bj_reduce_motion') === '1');
  reduceMotion.addEventListener('change', () => setMotionPreference(reduceMotion.checked));

  window.openLuxuryHelp = function () {
    previousFocus = document.activeElement;
    panel.classList.remove('hidden');
    // Inert game input while the modal is open.
    close.focus();
  };
  window.closeLuxuryHelp = function () {
    panel.classList.add('hidden');
    if (previousFocus && previousFocus.isConnected) previousFocus.focus();
  };
  panel.addEventListener('click', event => {
    if (event.target === panel) window.closeLuxuryHelp();
  });

  const actionKeys = new Map([
    ['d', 'dealBtn'],
    ['h', 'hitBtn'],
    ['s', 'standBtn'],
    ['x', 'doubleBtn'],
    ['p', 'splitBtn'],
  ]);
  const chipValues = [1, 5, 10, 25, 100];

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (!panel.classList.contains('hidden')) {
        event.preventDefault();
        window.closeLuxuryHelp();
      }
      return;
    }
    if (event.key === 'Tab' && !panel.classList.contains('hidden')) {
      const focusables = [...panel.querySelectorAll('button:not([disabled]),input:not([disabled])')];
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus();
      }
      return;
    }
    if (event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    if (target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName || '')) return;
    if (!panel.classList.contains('hidden')) return;
    if (['insuranceModal', 'bonusModal'].some(id => !document.getElementById(id)?.classList.contains('hidden'))) return;
    if (document.getElementById('challengePanel')?.classList.contains('hidden') === false) return;
    if (window.bjBusy) return;
    const key = event.key.toLowerCase();
    if (key === '?') {
      event.preventDefault(); window.openLuxuryHelp(); return;
    }
    if (/^[1-5]$/.test(key)) {
      const value = chipValues[Number(key) - 1];
      const button = document.querySelector('#chipsRow .chip[data-value="' + value + '"]');
      if (button && !button.disabled && !button.classList.contains('disabled')) {
        event.preventDefault(); button.click();
      }
      return;
    }
    if (key === 'c') {
      const clear = document.querySelector('#chipsRow .btn-clear');
      if (clear && !clear.disabled) { event.preventDefault(); clear.click(); }
      return;
    }
    const button = document.getElementById(actionKeys.get(key));
    if (button && !button.disabled) {
      event.preventDefault();
      button.click();
    }
  });

  // Visual chip selection feedback, without changing the bet logic.
  document.getElementById('chipsRow')?.addEventListener('click', event => {
    const chip = event.target.closest('.chip');
    if (!chip || chip.classList.contains('disabled') || window.bjBusy) return;
    chip.classList.remove('chip-picked');
    void chip.offsetWidth;
    chip.classList.add('chip-picked');
    setTimeout(() => chip.classList.remove('chip-picked'), 320);
  });
})();
