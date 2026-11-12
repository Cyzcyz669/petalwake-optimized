// Postcards: K (or the ✉ button) takes the view as it is and makes a postcard of it - a white
// border, the name of the place, a stamp, and a line about the flight so far - to save or share.
export class Postcard {
  constructor(game) {
    this.game = game;
    this.isOpen = false;
    const el = (this.el = document.createElement('div'));
    el.className = 'postcard';
    el.hidden = true;
    el.innerHTML = `<div class="pc-inner"><img alt="postcard"><div class="pc-row">
      <button data-act="share">share</button><a data-act="save" download="petalwake-postcard.jpg">save</a><button data-act="close">close</button></div></div>`;
    document.body.appendChild(el);
    el.addEventListener('click', (e) => {
      const a = e.target.dataset.act;
      if (a === 'close' || e.target === el) this.close();
      else if (a === 'share') this.share();
    });
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.code === 'KeyK' && game.state === 'play') this.isOpen ? this.close() : this.open();
      else if (e.code === 'Escape' && this.isOpen) this.close();
    });
    game.postcard = this;
  }

  _compose() {
    const g = this.game, src = g.renderer.domElement;
    g.renderOnce?.(1 / 60);                         // draw now, then copy before the buffer is let go
    const W = 1800, H = 1200, M = 54, foot = 170;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#fbf6ee'; x.fillRect(0, 0, W, H);
    // the photo, cropped to fill its window
    const pw = W - 2 * M, ph = H - M - foot, sa = src.width / src.height, da = pw / ph;
    let sw = src.width, sh = src.height, sx = 0, sy = 0;
    if (sa > da) { sw = sh * da; sx = (src.width - sw) / 2; } else { sh = sw / da; sy = (src.height - sh) / 2; }
    x.drawImage(src, sx, sy, sw, sh, M, M, pw, ph);
    x.strokeStyle = 'rgba(60,40,50,0.18)'; x.lineWidth = 2; x.strokeRect(M, M, pw, ph);
    // the caption
    const place = g.placeName?.() || 'the island';
    x.fillStyle = '#3a2734';
    x.font = 'italic 300 64px Fraunces, Georgia, serif';
    x.textBaseline = 'alphabetic';
    x.fillText(`Greetings from ${place}`, M + 6, H - foot + 92);
    const s = g.score, gp = g.gameplay;
    const bits = [];
    if (gp?.courier) bits.push(`${gp.courier.count} parcels delivered`);
    if (g.seeds) bits.push(`${g.seeds.count}/${g.seeds.total} wind seeds`);
    if (g.places) bits.push(`${g.places.count}/${g.places.total} treasures`);
    if (s) bits.push(`best chain ${Math.round(s.stats.bestChain).toLocaleString('en-US')}`);
    x.font = '500 24px Karla, system-ui, sans-serif';
    x.fillStyle = 'rgba(58,39,52,0.7)';
    x.fillText(bits.join('  ·  ').toUpperCase(), M + 8, H - foot + 140);
    // the stamp
    const r = 62, cx = W - M - r - 10, cy = H - foot / 2 - 4;
    x.save();
    x.translate(cx, cy); x.rotate(-0.12);
    x.strokeStyle = '#d0607f'; x.lineWidth = 4; x.setLineDash([7, 6]);
    x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.stroke();
    x.setLineDash([]);
    for (let i = 0; i < 5; i++) {
      x.fillStyle = i % 2 ? '#ffb7cf' : '#ff8fb5';
      x.beginPath(); x.ellipse(Math.cos(i * 1.2566) * 18, Math.sin(i * 1.2566) * 18, 15, 9, i * 1.2566, 0, Math.PI * 2); x.fill();
    }
    x.fillStyle = '#ffd36b'; x.beginPath(); x.arc(0, 0, 8, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#d0607f'; x.font = '600 14px Karla, sans-serif'; x.textAlign = 'center';
    x.fillText('PETALWAKE', 0, r - 14);
    x.restore();
    return c;
  }

  open() {
    if (this.isOpen) return;
    const g = this.game;
    let c;
    try { c = this._compose(); } catch (e) { console.error(e); g.toast?.('the camera jammed'); return; }
    this.isOpen = true;
    this.wasPaused = g.paused;
    g.paused = true;
    document.exitPointerLock?.();
    this.blob = null;
    this.el.querySelector('a').removeAttribute('href');
    c.toBlob((b) => {
      if (!b) { g.toast?.('the postcard could not be saved'); return; }
      this.blob = b;
      if (this.url) URL.revokeObjectURL(this.url);
      this.url = URL.createObjectURL(b);
      this.el.querySelector('img').src = this.url;
      this.el.querySelector('a').href = this.url;
    }, 'image/jpeg', 0.92);
    let canShare = false;
    try { canShare = typeof File !== 'undefined' && !!navigator.canShare?.({ files: [new File([new Blob()], 'x.jpg', { type: 'image/jpeg' })] }); } catch { /* sharing is not available */ }
    this.el.querySelector('[data-act="share"]').hidden = !canShare;
    this.el.hidden = false;
    g.sound?.whoosh?.(0.3);
  }

  async share() {
    if (!this.blob) return;
    const file = new File([this.blob], 'petalwake-postcard.jpg', { type: 'image/jpeg' });
    try { await navigator.share({ files: [file], title: 'Petalwake', text: `A postcard from ${this.game.placeName?.() || 'Petalwake'}` }); } catch { /* cancelled */ }
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.el.hidden = true;
    this.game.paused = !!this.wasPaused;
  }
}
