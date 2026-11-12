// Touch: fly the broom on a phone or tablet. A floating stick under the left thumb (wherever it
// lands), and under the right: hold to ride the gust, hold to ease up, and a button that comes up
// when there is somewhere to land (or to take off again). Along the top, small buttons for what the
// keyboard does with a letter. Tilt steering is there for those who like it.
//
// Everything is fed into Input as if it were one more device (input.touch), so the flight model,
// the landing and the game never know the difference.

const $ = (id) => document.getElementById(id);

export function isTouch(params = new URLSearchParams(location.search)) {
  if (params.has('notouch')) return false;
  if (params.has('touch')) return true;
  return !!(window.matchMedia?.('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && !window.matchMedia?.('(pointer: fine)').matches));
}

const RADIUS = 62;           // px: full deflection of the stick
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class TouchControls {
  constructor(game) {
    this.game = game;
    this.on = isTouch();
    this.state = { x: 0, y: 0, boost: false, brake: false };
    this.tilt = { on: false, x: 0, y: 0, base: null };
    game.touch = this;
    if (!this.on) return;
    document.body.classList.add('touch');
    game.input.touch = this.state;
    this._build();
    this._stick();
    this._buttons();
    this._acc = 0;
  }

  _build() {
    const root = (this.root = document.createElement('div'));
    root.id = 'touch';
    root.hidden = true;
    root.innerHTML = `
      <div class="t-stickzone" id="tZone"><div class="t-base" id="tBase"><div class="t-knob" id="tKnob"></div></div><p class="t-hint" id="tHint">drag here to steer</p></div>
      <div class="t-right">
        <button class="t-btn t-flip" id="tFlip" hidden>flip</button>
        <button class="t-btn t-land" id="tLand" hidden>land</button>
        <button class="t-btn t-brake" id="tBrake">ease</button>
        <button class="t-btn t-boost" id="tBoost">gust</button>
      </div>
      <div class="t-top">
        <button class="t-mini" data-act="rerun" title="race this leg again">↺</button>
        <button class="t-mini" data-act="camera" title="camera">◎</button>
        <button class="t-mini" data-act="journal" title="journal">❦</button>
        <button class="t-mini" data-act="postcard" title="postcard">✉</button>
        <button class="t-mini" data-act="tilt" title="tilt to steer">⟲</button>
        <button class="t-mini" data-act="invert" title="invert up and down">⇅</button>
        <button class="t-mini" data-act="mute" title="sound">♪</button>
      </div>
      <div class="t-rotate" id="tRotate">turn your phone sideways for the widest view <button data-act="rot-ok">ok</button></div>`;
    document.body.appendChild(root);
    // no page scrolling, pinching or double-tap zoom while flying
    for (const ev of ['touchmove', 'gesturestart', 'dblclick']) root.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
    document.addEventListener('touchmove', (e) => { if (this.game.state === 'play' && !e.target.closest?.('.journal, .postcard')) e.preventDefault(); }, { passive: false });
  }

  _stick() {
    const zone = $('tZone'), base = $('tBase'), knob = $('tKnob'), s = this.state;
    let id = null, ox = 0, oy = 0;
    const move = (e) => {
      const dx = e.clientX - ox, dy = e.clientY - oy, d = Math.hypot(dx, dy), k = d > RADIUS ? RADIUS / d : 1;
      knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
      // a small dead zone, then a soft curve: fine corrections near the middle, full bank at the rim
      const curve = (v) => { const a = Math.abs(v); return a < 0.08 ? 0 : Math.sign(v) * Math.pow((a - 0.08) / 0.92, 1.35); };
      s.x = curve(clamp(dx / RADIUS, -1, 1));
      s.y = curve(clamp(dy / RADIUS, -1, 1));
    };
    zone.addEventListener('pointerdown', (e) => {
      if (id !== null) return;
      id = e.pointerId;
      zone.setPointerCapture(id);
      ox = e.clientX; oy = e.clientY;
      const rect = zone.getBoundingClientRect();
      base.style.left = `${ox - rect.left}px`; base.style.top = `${oy - rect.top}px`;
      base.classList.add('on');
      $('tHint').classList.add('gone');
      move(e);
    });
    zone.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
    const up = (e) => {
      if (e.pointerId !== id) return;
      id = null; s.x = 0; s.y = 0;
      knob.style.transform = '';
      base.classList.remove('on');
    };
    zone.addEventListener('pointerup', up);
    zone.addEventListener('pointercancel', up);
    zone.addEventListener('lostpointercapture', up);
  }

  _hold(el, on, off) {
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.setPointerCapture(e.pointerId); el.classList.add('down'); on(e); this.buzz(6); });
    const end = (e) => { el.classList.remove('down'); off?.(e); };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', end);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _buttons() {
    const g = this.game, inp = g.input, s = this.state;
    this._hold($('tBoost'), () => { s.boost = true; }, () => { s.boost = false; });
    // ease up is the brake; a tap of it is a Space (takes off again from a pad, like the keyboard)
    this._hold($('tBrake'), () => { s.brake = true; inp.pressed.add('Space'); }, () => { s.brake = false; });
    this._hold($('tLand'), () => {
      const L = g.gameplay?.landing;
      if (L?.landed) inp.pressed.add('Space'); else inp.pressed.add('Space2');
    });
    this._hold($('tFlip'), () => inp.pressed.add('KeyQ'));
    this.root.querySelector('.t-top').addEventListener('click', (e) => this._act(e.target.closest('button')?.dataset.act));
    this.root.querySelector('.t-rotate').addEventListener('click', (e) => { if (e.target.dataset.act === 'rot-ok') { this.rotOk = true; $('tRotate').classList.remove('show'); } });
  }

  _act(a) {
    const g = this.game, inp = g.input;
    if (!a) return;
    this.buzz(5);
    if (a === 'camera') inp.pressed.add('KeyC');
    else if (a === 'mute') inp.pressed.add('KeyM');
    else if (a === 'rerun') inp.pressed.add('KeyR');
    else if (a === 'invert') inp.pressed.add('KeyI');
    else if (a === 'postcard') g.postcard?.open();
    else if (a === 'journal') { const j = g.places?.journal; if (j && (j.open || j.canOpen())) j.toggle(); }
    else if (a === 'tilt') this.toggleTilt();
  }

  /** Tilt: the phone held as it was when switched on is level; roll it to bank, tip it to dive. */
  async toggleTilt() {
    const t = this.tilt, g = this.game;
    if (t.on) { t.on = false; window.removeEventListener('deviceorientation', this._orient); this.state.tx = 0; this.state.ty = 0; g.toast?.('tilt off · stick steering'); this._mark(); return; }
    if (typeof DeviceOrientationEvent === 'undefined') { g.toast?.('tilt is not available on this device'); return; }
    try {
      if (DeviceOrientationEvent.requestPermission) {
        if ((await DeviceOrientationEvent.requestPermission()) !== 'granted') throw new Error('denied');
      }
    } catch { g.toast?.('tilt needs motion access'); return; }
    t.on = true; t.base = null;
    this._orient = (e) => {
      if (e.beta == null) return;
      const ang = (screen.orientation?.angle ?? window.orientation ?? 0) | 0;
      // across the screen, and into it, whichever way up the phone is
      let roll, pitch;
      if (ang === 90) { roll = e.beta; pitch = -e.gamma; } else if (ang === -90 || ang === 270) { roll = -e.beta; pitch = e.gamma; } else { roll = e.gamma; pitch = e.beta; }
      if (!t.base) t.base = { roll, pitch };
      this.state.tx = clamp((roll - t.base.roll) / 28, -1, 1);
      this.state.ty = clamp((pitch - t.base.pitch) / 24, -1, 1);
    };
    window.addEventListener('deviceorientation', this._orient);
    g.toast?.('tilt on · hold the phone the way it is now');
    this._mark();
  }
  _mark() { this.root.querySelector('[data-act="tilt"]').classList.toggle('lit', this.tilt.on); }

  buzz(ms) { try { navigator.vibrate?.(ms); } catch { /* no haptics */ } }

  /** The game has begun: full screen and sideways where the browser allows it. */
  begin() {
    if (!this.on) return;
    this.root.hidden = false;
    const d = document.documentElement;
    const fs = d.requestFullscreen || d.webkitRequestFullscreen;
    try { fs?.call(d, { navigationUI: 'hide' })?.then?.(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch?.(() => {}); } catch { /* not allowed here */ }
  }

  update(dt) {
    if (!this.on || this.game.state !== 'play') return;
    this._acc += dt;
    if (this._acc < 0.1) return;
    this._acc = 0;
    const g = this.game, gp = g.gameplay, L = gp?.landing;
    const land = $('tLand');
    const canLand = L && L.state === 'fly' && gp.zone, canGo = L?.landed;
    land.hidden = !(canLand || canGo);
    land.textContent = canGo ? 'take off' : 'land';
    land.classList.toggle('gold', !!(canLand && gp.zone === gp.courier?.target));
    $('tFlip').hidden = !gp?.trick?.unlocked;
    $('tFlip').classList.toggle('cool', !!(gp?.trick && (gp.trick.active || gp.trick.cool > 0)));
    $('tRotate').classList.toggle('show', !this.rotOk && innerHeight > innerWidth * 1.1);
    // a nudge in the hand for a knock against a wall, and for a parcel handed over
    const f = g.flight, n = gp?.courier?.count || 0;
    if (f.bump > 0.5 && !this._bumped) this.buzz(25);
    this._bumped = f.bump > 0.5;
    if (this._n !== undefined && n > this._n) this.buzz([20, 60, 20]);
    this._n = n;
  }
}
