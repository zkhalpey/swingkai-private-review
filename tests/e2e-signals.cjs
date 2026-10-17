
const { chromium, devices } = require('playwright');
const fs = require('fs'); const PORT = process.argv[2];
(async () => {
  const browser = await chromium.launch(); const ctx = await browser.newContext({ ...devices['iPhone 14'] }); const page = await ctx.newPage();
  const errs = [], failed = []; page.on('pageerror', e => errs.push(e.message)); page.on('requestfailed', r => failed.push(r.url()));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const URL = `http://127.0.0.1:${PORT}/index.html`;
  await page.goto(URL); await page.evaluate(() => { localStorage.clear(); sessionStorage.setItem('swingkai_preview', '1'); });
  await page.goto(URL); await page.waitForTimeout(500);
  const txt = async sel => (await page.locator(sel).innerText()).replace(/\s*\n\s*/g, ' | ');
  const out = {};
  // readiness
  await page.click('[data-action="start-plan"]');
  await page.fill('#readinessInput', '64'); await page.click('[data-action="save-readiness"]');
  out.readiness = await page.locator('#readinessNote').innerText();
  out.readinessShow = await page.locator('#readinessShow').innerText();
  // motion toggle + begin
  out.motionEnabled = await page.locator('#motionToggle').isEnabled();
  await page.check('#motionToggle'); await page.selectOption('#placementSel', 'trouser-pocket');
  await page.click('[data-reps="6"]'); await page.click('#beginBtn'); await page.waitForTimeout(200);
  out.liveVisible = await page.locator('#liveMeter').isVisible();
  // synthesize devicemotion: 6 swings, 100 Hz, rotationRate in deg/s. Use the engine's synth via module import in page.
  await page.evaluate(async () => {
    const m = await import('./swing-review.js');
    const samples = m.synthSwings({ n: 6, jitter: 0.04, drift_down: 0.02 });
    const base = performance.now();
    for (const s of samples) {
      const ev = new Event('devicemotion'); const d = 180 / Math.PI;
      Object.defineProperty(ev, 'rotationRate', { value: { alpha: s.gx * d, beta: s.gy * d, gamma: s.gz * d } });
      Object.defineProperty(ev, 'acceleration', { value: { x: s.ax * 9.81, y: s.ay * 9.81, z: s.az * 9.81 } });
      Object.defineProperty(ev, 'timeStamp', { value: base + s.t * 1000 });
      window.dispatchEvent(ev);
    }
  });
  await page.waitForTimeout(400);
  out.liveHz = await page.locator('#liveHz').innerText(); out.liveSwings = await page.locator('#liveSwings').innerText();
  for (let i = 0; i < 6; i++) await page.click('[data-action="complete-rep"]');
  await page.waitForTimeout(200);
  out.reviewCard = (await txt('#sessionReview')).slice(0, 1200);
  await page.click('[data-rating=control] [data-v="4"]'); await page.fill('#reflectNote', 'Second half felt quick.');
  await page.click('[data-action="save-session"]');
  out.progressLog = (await txt('#reflectLog')).slice(0, 300);
  // science
  await page.click('[data-tab="science"]');
  out.science = (await txt('[data-screen=science]')).slice(0, 900);
  // import a Watch file
  const m = await page.evaluate(async () => { const m = await import('./swing-review.js'); return m.synthSwings({ n: 8, jitter: 0.02 }); });
  const half = Math.ceil(m.length / 2);
  const file = { source: 'apple-watch', placement: 'lead-wrist', marked_reps: 8, batches: [{ session_id: 'w1', batch_sequence: 0, sample_sequence: 0, monotonic_timestamp: 0, orientation: 'crown-right', battery_state: '0.8', samples: m.slice(0, half) }, { session_id: 'w1', batch_sequence: 1, sample_sequence: half, monotonic_timestamp: m[half].t, orientation: 'crown-right', battery_state: '0.8', samples: m.slice(half) }] };
  fs.writeFileSync('/tmp/watch-export.json', JSON.stringify(file));
  await page.setInputFiles('#importFile', '/tmp/watch-export.json'); await page.waitForTimeout(400);
  out.importNote = await page.locator('#importNote').innerText();
  out.trendNote = await page.locator('#sciTrendNote').innerText();
  out.trendBars = await page.locator('#sciTrend i').count();
  // coach sees reviews
  await page.click('[data-role="coach"]'); out.coachLog = (await txt('#coachLog')).slice(0, 400);
  // persistence
  await page.reload(); await page.waitForTimeout(400);
  out.persisted = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('swingkai_state_v1')); return { sessions: s.sessions.length, readiness: s.readiness, firstReview: s.sessions[0].review && s.sessions[0].review.quality, rawSamplesStored: JSON.stringify(s).length }; });
  out.overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  out.errs = errs; out.failed = failed;
  console.log(JSON.stringify(out, null, 1)); await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
