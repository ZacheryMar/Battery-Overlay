// ==UserScript==
// @name         Battery Pro iOS
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Muestra el porcentaje de batería en cualquier ventana con un estilo Apple. Toggle: Ctrl+Shift+B. Arrastrable y recuerda posición.
// @match        *://*/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  if (!('getBattery' in navigator)) return;

  const css = `
#battery-overlay-appleish {
  position: fixed;
  left: 20px;          /* Alineado hacia la izquierda */
  top: 8%;             /* Cerca del borde superior */
  z-index: 2147483647;
  background: linear-gradient(180deg, rgba(255,255,255,0.92), rgba(250,250,250,0.88));
  color: #0b0b0b;
  padding: 14px 18px;
  border-radius: 16px;
  box-shadow: 0 12px 30px rgba(0,0,0,0.30);
  display: flex;
  align-items: center;
  gap: 14px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial;
  user-select: none;
  min-width: 220px;
  max-width: 420px;
  backdrop-filter: blur(8px) saturate(1.05);
  cursor: grab;
}
#battery-overlay-appleish:active { cursor: grabbing; }
.batt-left {
  display:flex;
  align-items:center;
  gap:12px;
}
.batt-shell {
  width: 56px;
  height: 28px;
  border-radius: 6px;
  border: 2px solid rgba(0,0,0,0.12);
  position: relative;
  box-sizing: border-box;
  background: linear-gradient(180deg, rgba(255,255,255,0.6), rgba(245,245,245,0.6));
  overflow: hidden;
}
.batt-shell::after {
  content: "";
  position: absolute;
  right: -6px;
  top: 7px;
  width: 6px;
  height: 14px;
  border-radius: 2px;
  background: rgba(0,0,0,0.12);
}
.batt-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 50%;
  background: linear-gradient(90deg, #4cd964, #32d74b);
  transition: width 300ms ease, background 300ms ease;
  box-shadow: inset 0 -6px 12px rgba(0,0,0,0.06);
}
.batt-text {
  display:flex;
  flex-direction: column;
  gap:2px;
}
.batt-percent {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.4px;
}
.batt-sub {
  font-size: 12px;
  color: rgba(0,0,0,0.55);
}
.batt-charge {
  width: 34px;
  height: 34px;
  display:flex;
  align-items:center;
  justify-content:center;
  border-radius: 8px;
  background: rgba(0,0,0,0.06);
}
.batt-charge svg { width:18px; height:18px; display:block; }
.batt-hidden { display:none !important; }
@media (max-width:400px){
  #battery-overlay-appleish{
    left: 10px;
    top: 6%;
    min-width: 180px;
  }
}
`;

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const overlay = document.createElement('div');
  overlay.id = 'battery-overlay-appleish';
  overlay.innerHTML = `
    <div class="batt-left">
      <div class="batt-shell" aria-hidden="true">
        <div class="batt-fill" style="width:50%"></div>
      </div>
      <div class="batt-text">
        <div class="batt-percent">--%</div>
        <div class="batt-sub">Estado: --</div>
      </div>
    </div>
    <div class="batt-charge" title="Clic para ocultar/mostrar">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M13 2L3 14h7l-1 8L21 10h-7l-1-8z" fill="#000" opacity="0.9"/>
      </svg>
    </div>
  `;
  document.body.appendChild(overlay);

  const fill = overlay.querySelector('.batt-fill');
  const percentEl = overlay.querySelector('.batt-percent');
  const subEl = overlay.querySelector('.batt-sub');
  const chargeBtn = overlay.querySelector('.batt-charge');

  let visible = true;
  function setVisible(v) {
    visible = !!v;
    overlay.style.display = visible ? 'flex' : 'none';
    localStorage.setItem('battery_overlay_visible', visible ? '1' : '0');
  }

  if (localStorage.getItem('battery_overlay_visible') === '0') setVisible(false);
  chargeBtn.addEventListener('click', () => setVisible(!visible));

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyB') {
      e.preventDefault();
      setVisible(!visible);
    }
  });

  let dragging = false, startX=0, startY=0, origLeft=0, origTop=0;
  function getSavedPos() {
    try { return JSON.parse(localStorage.getItem('battery_overlay_pos') || 'null'); } catch { return null; }
  }
  function savePos(x,y) { localStorage.setItem('battery_overlay_pos', JSON.stringify([x,y])); }
  const saved = getSavedPos();
  if (saved && Array.isArray(saved)) {
    overlay.style.left = saved[0] + 'px';
    overlay.style.top = saved[1] + 'px';
  }

  overlay.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    dragging = true;
    startX = ev.clientX; startY = ev.clientY;
    const rect = overlay.getBoundingClientRect();
    origLeft = rect.left; origTop = rect.top;
    overlay.setPointerCapture(ev.pointerId);
    ev.preventDefault();
  });

  window.addEventListener('pointermove', (ev) => {
    if (!dragging) return;
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    const newLeft = Math.max(8, origLeft + dx);
    const newTop = Math.max(8, origTop + dy);
    overlay.style.left = newLeft + 'px';
    overlay.style.top = newTop + 'px';
  });

  window.addEventListener('pointerup', (ev) => {
    if (!dragging) return;
    dragging = false;
    overlay.releasePointerCapture(ev.pointerId);
    const rect = overlay.getBoundingClientRect();
    savePos(rect.left, rect.top);
  });

  function formatTime(minutes) {
    if (!isFinite(minutes) || minutes <= 0) return '—';
    const h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
    return (h ? h + 'h ' : '') + m + 'm';
  }

  navigator.getBattery().then(function(battery) {
    function update() {
      const pct = Math.round(battery.level * 100);
      percentEl.textContent = pct + '%';
      fill.style.width = pct + '%';

      if (battery.charging) {
        fill.style.background = 'linear-gradient(90deg, #0a84ff, #32d74b)';
      } else if (pct <= 10) {
        fill.style.background = 'linear-gradient(90deg, #ff3b30, #ff6b6b)';
      } else if (pct <= 30) {
        fill.style.background = 'linear-gradient(90deg, #ff9f0a, #ffcc66)';
      } else {
        fill.style.background = 'linear-gradient(90deg, #4cd964, #32d74b)';
      }

      const state = battery.charging
        ? 'Cargando • ' + (battery.chargingTime && battery.chargingTime !== Infinity ? formatTime(battery.chargingTime/60) : '—')
        : 'Descargando • ' + (battery.dischargingTime && battery.dischargingTime !== Infinity ? formatTime(battery.dischargingTime/60) : '—');
      subEl.textContent = state;

      overlay.animate([{ transform: 'translateY(-2px)' }, { transform: 'translateY(0)' }], { duration: 220, easing: 'ease-out' });
    }

    battery.addEventListener('levelchange', update);
    battery.addEventListener('chargingchange', update);
    battery.addEventListener('chargingtimechange', update);
    battery.addEventListener('dischargingtimechange', update);
    update();
  }).catch(() => {
    overlay.classList.add('batt-hidden');
  });

})();
