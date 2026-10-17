
const { chromium, devices } = require('playwright');
const PORT = process.argv[2];
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 14'] });
  const page = await ctx.newPage();
  const errs = [], failed = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('requestfailed', r => failed.push(r.url()));
  const URL = `http://127.0.0.1:${PORT}/index.html`;
  await page.goto(URL); await page.evaluate(() => { localStorage.clear(); sessionStorage.setItem('swingkai_preview', '1'); });
  await page.goto(URL); await page.waitForTimeout(400);
  const txt = async sel => (await page.locator(sel).innerText()).replace(/\s*\n\s*/g, ' | ');
  const out = {};
  out.home = await txt('[data-screen=home]');
  await page.click('[data-action="start-plan"]');
  out.plan = await txt('#planView');
  await page.click('[data-reps="6"]'); await page.click('[data-mode="react"]');
  out.beginBtn = await page.locator('#beginBtn').innerText();
  await page.click('#beginBtn');
  out.rep = await txt('#repView');
  for (let i = 0; i < 6; i++) await page.click('[data-action="complete-rep"]');
  out.completeVisible = await page.locator('#completeView').isVisible();
  out.completeTitle = await page.locator('#completeTitle').innerText();
  out.completeSub = await page.locator('#completeSub').innerText();
  await page.click('[data-rating=confidence] [data-v="4"]'); await page.click('[data-rating=pace] [data-v="3"]'); await page.click('[data-rating=control] [data-v="5"]');
  await page.fill('#reflectNote', 'Felt the ground more on the trail foot.');
  await page.click('[data-action="save-session"]');
  out.activeAfterSave = await page.locator('.screen.active').getAttribute('data-screen');
  out.progress = await txt('[data-screen=progress]');
  // coach view
  await page.click('[data-role="coach"]');
  out.activeCoach = await page.locator('.screen.active').getAttribute('data-screen');
  out.coachVisible = await page.locator('#coachCoachView').isVisible();
  out.coach = (await txt('#coachCoachView')).slice(0, 1500);
  await page.fill('#coachNoteEdit', 'Trail foot pressure first, then let the hips blend.');
  await page.selectOption('#assignModule', 'hips'); await page.selectOption('#assignMode', 'animate'); await page.selectOption('#assignReps', '4');
  await page.click('[data-action="assign"]');
  out.assignSaved = await page.locator('#assignSaved').innerText();
  out.advanceBtn = await page.locator('#advanceBtn').innerText();
  await page.click('#advanceBtn');
  out.advanceAfter = await page.locator('#advanceBtn').innerText();
  out.ledger = await txt('#ledgerCoach');
  // back to golfer
  await page.click('[data-role="golfer"]');
  out.homeAfter = (await txt('[data-screen=home]')).slice(0, 500);
  await page.click('[data-tab="practice"]');
  out.pills = await txt('#stagePills');
  out.state = await page.evaluate(() => localStorage.getItem('swingkai_state_v1'));
  // reload persistence
  await page.reload(); await page.waitForTimeout(300);
  out.persistedGreeting = await page.locator('#greeting').innerText();
  out.persistedHero = await page.locator('#heroTitle').innerText();
  // overflow check
  out.overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  await page.screenshot({ path: process.env.HOME + '/.hermes/cache/scratch/sk_home_mobile.png' });
  await page.click('[data-tab="coach"]'); await page.screenshot({ path: process.env.HOME + '/.hermes/cache/scratch/sk_coach_mobile.png', fullPage: false });
  out.errs = errs; out.failed = failed;
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
