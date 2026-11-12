// Score: the flow chain, the clock on every errand, medals, records and the ghost of your best run.
//
// Flow. Flying well keeps a chain going: skimming the meadow or the sea, carving tight and low,
// riding the gale at full tilt, and the moments - a wind seed, a kickflip, a treasure, a parcel -
// that kick it up. The longer it runs the higher the multiplier climbs; a few seconds of doing
// nothing much, a bump into a wall or setting down on a pad banks it.
//
// Errands. The clock runs from the moment she is under way to the moment her boots touch the
// parcel's pad. Each route has a par from its length; beat it for gold. The best time on each
// route is kept, with a ghost of the flight, and R puts you back at the start of the leg to race it.
import * as THREE from 'three';

export const FLOW = {
  SKIM: 2.4,        // m above ground or sea that counts as skimming
  GRACE: 2.6,       // s of nothing before the chain banks
  RAMP: 5,          // s of chain per step of multiplier
  MAX: 9,           // the multiplier tops out here
  CRASH: 0.55,      // a bump this hard breaks the chain (banked at half)
};
export const PAR = { SPEED: 40, PAD: 8, SILVER: 1.3, BRONZE: 1.7 };
const GHOSTS = 30, SAMPLE = 0.1;

export const fmtTime = (s) => { const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r < 10 ? '0' : ''}${r.toFixed(1)}`; };
export const fmtPts = (n) => Math.round(n).toLocaleString('en-US');
const $ = (id) => document.getElementById(id);
const MEDAL = { gold: '★ gold', silver: '✦ silver', bronze: '• bronze', '': 'delivered' };

class Ghost {
  constructor(overlay) {
    this.group = new THREE.Group();
    this.group.visible = false;
    const mat = new THREE.MeshBasicMaterial({ color: 0x9fe6ff, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), mat);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 12), mat.clone());
    halo.material.opacity = 0.18;
    this.ball.add(halo);
    this.N = 40;
    this.trailPos = new Float32Array(this.N * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.trailPos, 3));
    this.trail = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x9fe6ff, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.trail.frustumCulled = false;
    this.group.add(this.ball, this.trail);
    overlay.add(this.group);
    this.data = null;
  }
  at(t, out) {
    const p = this.data.p, n = p.length / 3, u = Math.min(t / SAMPLE, n - 1), i = Math.floor(u), k = u - i, j = Math.min(i + 1, n - 1);
    out.set((p[i * 3] + (p[j * 3] - p[i * 3]) * k) / 10, (p[i * 3 + 1] + (p[j * 3 + 1] - p[i * 3 + 1]) * k) / 10, (p[i * 3 + 2] + (p[j * 3 + 2] - p[i * 3 + 2]) * k) / 10);
    return out;
  }
  show(t) {
    if (!this.data) { this.group.visible = false; return; }
    this.group.visible = true;
    const v = new THREE.Vector3();
    this.at(t, this.ball.position);
    for (let i = 0; i < this.N; i++) { this.at(Math.max(0, t - i * 0.06), v); this.trailPos.set([v.x, v.y, v.z], i * 3); }
    this.trail.geometry.attributes.position.needsUpdate = true;
    this.ball.material.opacity = t > this.data.t ? 0.25 : 0.75;    // (arrived: a faint mark on the pad)
  }
}

export class Score {
  constructor(game, store, hud) {
    this.game = game;
    this.store = store;
    this.hud = hud;
    this.stats = { medals: { gold: 0, silver: 0, bronze: 0 }, bestChain: 0, bestRun: 0, delivered: 0, ...store.get('stats.v1', {}) };
    this.routes = store.get('routes.v1', {});
    this.ghosts = store.get('ghosts.v1', {});
    // the chain
    this.run = 0; this.chain = 0; this.mult = 1; this.bonus = 0; this.heat = 0; this.chainT = 0; this.label = ''; this.pop = 0;
    // the errand
    this.leg = null; this.prev = null;
    this.ghost = new Ghost(game.pipeline.overlay);
    this.seen = { seeds: game.seeds?.count || 0, flips: 0, treasures: game.places?.count || 0 };
    this.el = { flow: $('flow'), label: $('flowLabel'), mult: $('flowMult'), pts: $('flowPts'), heat: $('flowHeat'), run: $('runPts'),
      time: $('jobTime'), par: $('jobPar'), story: $('jobStory') };
    this._acc = 0;
    this._v = new THREE.Vector3();
    game.score = this;
    this.records();
  }

  // ------------------------------------------------------------------------------------ flow
  /** A moment that kicks the chain up: points (times the multiplier) and a step or two on it. */
  event(label, pts, steps = 1) {
    if (this.game.state !== 'play') return;
    this.bonus += steps;
    this._mult();
    this.chain += pts * this.mult;
    this.heat = 1;
    this.label = label;
    this.pop = 1;
    this.el.flow?.classList.remove('pop'); void this.el.flow?.offsetWidth; this.el.flow?.classList.add('pop');
  }
  _mult() { this.mult = Math.min(FLOW.MAX, 1 + Math.floor(this.chainT / FLOW.RAMP) + this.bonus); }

  bank(why = '') {
    if (this.chain <= 0) { this._reset(); return; }
    const pts = Math.round(why === 'bump' ? this.chain * 0.5 : this.chain);
    this.run += pts;
    if (pts > this.stats.bestChain) { this.stats.bestChain = pts; if (pts > 500) this.game.toast?.(`best chain yet · ${fmtPts(pts)}`); }
    if (this.run > this.stats.bestRun) this.stats.bestRun = this.run;
    this._save();
    if (why === 'bump') this.game.toast?.(`bumped · chain halved, ${fmtPts(pts)} kept`);
    this._reset();
  }
  _reset() { this.chain = 0; this.mult = 1; this.bonus = 0; this.heat = 0; this.chainT = 0; this.label = ''; }

  _flow(dt) {
    const g = this.game, f = g.flight, L = g.gameplay?.landing;
    if (g.state !== 'play') return;
    if (L && L.busy) { if (this.chain > 0) this.bank(); return; }
    if (f.bump > FLOW.CRASH && this.chain > 0) { this.bank('bump'); return; }
    // watch the counters other systems keep
    const s = g.seeds?.count || 0, fl = g.gameplay?.trick?.count || 0, tr = g.places?.count || 0;
    if (s > this.seen.seeds) this.event('wind seed', 100, 1);
    if (fl > this.seen.flips) this.event(f.agl < 3 ? 'low kickflip' : 'kickflip', f.agl < 3 ? 600 : 300, 2);
    if (tr > this.seen.treasures) this.event('treasure', 1500, 3);
    this.seen.seeds = s; this.seen.flips = fl; this.seen.treasures = tr;

    const sea = g.terrain.heightAt(f.pos.x, f.pos.z) < 0.5;
    const tags = [];
    let rate = 0;
    if (f.agl < FLOW.SKIM && f.speed > 18) { rate += 30 * (f.speed / 33) * (f.agl < 1.2 ? 1.5 : 1); tags.push(sea ? 'wave skim' : 'skim'); }
    if (Math.abs(f.roll) > 0.55 && f.agl < 7) { rate += 22; tags.push('carve'); }
    if (f.speed > 58) { rate += 16; tags.push('gale'); }
    if (rate > 0) {
      this.heat = Math.min(1, this.heat + dt * 1.6);
      this.chainT += dt;
      this._mult();
      this.chain += rate * this.mult * dt;
      if (this.pop <= 0) this.label = tags.join(' · ');
    } else if (this.chain > 0) {
      this.heat -= dt / FLOW.GRACE;
      if (this.heat <= 0) this.bank();
    }
    this.pop -= dt * 0.8;
  }

  // ---------------------------------------------------------------------------------- errands
  /** A parcel was handed over at `from` (null: the first of the visit) for `to`. */
  newLeg(from, to) {
    if (this.leg && this.leg.to === to && this.leg.from === from) return;
    const d = from ? Math.hypot(to.pos.x - from.pos.x, to.pos.z - from.pos.z) : 0;
    const key = from ? `${from.id}>${to.id}` : null;
    this.leg = { from, to, key, par: from ? d / PAR.SPEED + PAR.PAD : 0, t: 0, on: false, snap: null, rec: [], recT: 0 };
    this.ghost.data = key ? this.ghosts[key] || null : null;
  }

  /** Boots on `pad`. Returns how the errand went if it was the parcel's. */
  delivered(pad) {
    const leg = this.leg;
    if (!leg || leg.to !== pad) return null;
    const t = leg.t, par = leg.par;
    let medal = '';
    if (leg.from && leg.snap) medal = t <= par ? 'gold' : t <= par * PAR.SILVER ? 'silver' : t <= par * PAR.BRONZE ? 'bronze' : '';
    const prev = leg.key ? this.routes[leg.key] : undefined;
    const best = !!leg.key && leg.snap && (prev === undefined || t < prev);
    if (best) {
      this.routes[leg.key] = +t.toFixed(2);
      leg.rec.push(...[pad.pos.x, pad.pos.y + 1, pad.pos.z].map((v) => Math.round(v * 10)));
      this.ghosts[leg.key] = { t: +t.toFixed(2), p: leg.rec, at: Date.now() };
      const keys = Object.keys(this.ghosts);
      if (keys.length > GHOSTS) keys.sort((a, b) => this.ghosts[a].at - this.ghosts[b].at).slice(0, keys.length - GHOSTS).forEach((k) => delete this.ghosts[k]);
      this.store.set('routes.v1', this.routes);
      this.store.set('ghosts.v1', this.ghosts);
    }
    if (medal) this.stats.medals[medal]++;
    this.stats.delivered++;
    this.event('delivery', 1000 + { gold: 1500, silver: 800, bronze: 300, '': 0 }[medal], medal === 'gold' ? 3 : 2);
    this.bank();
    this._save();
    this.prev = { ...leg };
    return { t, par, medal, best: best && prev !== undefined, first: best && prev === undefined, prevBest: prev, timed: !!(leg.from && leg.snap) };
  }

  medalName(m) { return MEDAL[m] || 'delivered'; }

  /** R: back to the start of this leg (or, before it has begun, the one just flown) to race the ghost. */
  rerun() {
    const g = this.game, gp = g.gameplay;
    let leg = this.leg;
    if ((!leg || !leg.snap || leg.t < 1) && this.prev && this.prev.snap) {
      leg = this.prev;
      gp.courier.setTarget(leg.to, leg.from);
      this.newLeg(leg.from, leg.to);
      this.leg.snap = leg.snap;
    } else if (!leg || !leg.snap) { g.toast?.('fly a leg first, then R to race it again'); return; }
    const s = this.leg.snap;
    gp.landing.busy && gp.landing.abort();
    g.fly(s.x, s.z, s.agl, s.yaw, s.speed);
    this.leg.t = 0; this.leg.rec = []; this.leg.recT = 0; this.leg.on = true;
    this.ghost.data = this.ghosts[this.leg.key] || null;
    this._reset();
    const best = this.routes[this.leg.key];
    g.toast?.(best ? `rerun · beat ${fmtTime(best)}` : `rerun · par ${fmtTime(this.leg.par)}`);
  }

  _errand(dt) {
    const g = this.game, f = g.flight, L = g.gameplay?.landing, leg = this.leg;
    if (!leg || g.state !== 'play' || !L) { this.ghost.group.visible = false; return; }
    const st = L.state;
    if (!leg.on && st === 'fly') {
      leg.on = true;
      leg.snap = { x: f.pos.x, z: f.pos.z, agl: Math.max(f.agl, 2), yaw: (f.yaw * 180) / Math.PI, speed: f.speed };
    }
    if (leg.on && (st === 'fly' || st === 'approach' || st === 'settle')) {
      leg.t += dt;
      leg.recT += dt;
      if (leg.key && leg.recT >= SAMPLE && leg.rec.length < 3 * 6000) {
        leg.recT -= SAMPLE;
        leg.rec.push(Math.round(f.pos.x * 10), Math.round(f.pos.y * 10), Math.round(f.pos.z * 10));
      }
    }
    if (leg.on && this.ghost.data && st !== 'landed') this.ghost.show(leg.t); else this.ghost.group.visible = false;
  }

  // -------------------------------------------------------------------------------------- hud
  _hud() {
    const e = this.el, leg = this.leg;
    if (e.flow) {
      const on = this.chain > 0;
      e.flow.classList.toggle('show', on);
      if (on) {
        e.label.textContent = this.label;
        e.mult.textContent = `×${this.mult}`;
        e.pts.textContent = fmtPts(this.chain);
        e.heat.style.width = `${Math.round(Math.max(0, this.heat) * 100)}%`;
      }
    }
    if (e.run) e.run.textContent = fmtPts(this.run + this.chain);
    if (e.time && leg) {
      e.time.textContent = leg.on ? fmtTime(leg.t) : '–:–';
      const best = leg.key ? this.routes[leg.key] : undefined;
      e.par.textContent = leg.from ? `par ${fmtTime(leg.par)}${best !== undefined ? ` · best ${fmtTime(best)}` : ''}` : 'first parcel · untimed';
      const r = leg.from ? leg.t / leg.par : 0;
      e.time.dataset.medal = !leg.from ? '' : r <= 1 ? 'gold' : r <= PAR.SILVER ? 'silver' : r <= PAR.BRONZE ? 'bronze' : 'none';
    }
  }

  /** The title screen's little table of records. */
  records() {
    const el = $('records');
    if (!el) return;
    const s = this.stats, m = s.medals, routes = Object.keys(this.routes).length;
    if (!s.delivered && !s.bestChain) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = `<div><b>${fmtPts(s.bestRun)}</b><span>best run</span></div><div><b>${fmtPts(s.bestChain)}</b><span>best chain</span></div>`
      + `<div><b>${m.gold}<i class="m gold">★</i> ${m.silver}<i class="m silver">✦</i> ${m.bronze}<i class="m bronze">•</i></b><span>medals</span></div><div><b>${routes}</b><span>routes timed</span></div>`;
  }

  _save() { this.store.set('stats.v1', this.stats); }

  update(dt) {
    if (this.game.state === 'play' && this.game.input.take('KeyR')) this.rerun();
    this._flow(dt);
    this._errand(dt);
    this._acc += dt;
    if (this._acc >= 0.066) { this._acc = 0; this._hud(); }
  }
}
