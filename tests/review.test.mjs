import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const rx = s => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

test('review exposes a complete golfer journey', () => {
  for (const marker of [
    'id="greeting"', 'Start today’s session', 'Your lesson plan', 'Kinetic Swing System',
    'Base, Control, Sequence, Transfer', 'Guided practice', 'Mark rep complete', 'Session complete',
    'What did you notice?', 'Save and view progress', 'Your progress', 'Reflection log', 'Coach feedback',
  ]) assert.match(html, rx(marker));
});

test('all nine Kinetic Swing System modules and four stages are present', () => {
  for (const m of ['Build the base', 'Find position of strength', 'Own the ground', 'Blend the hips from the feet',
    'Keep the transition organised', 'Sequence, then speed', 'Deliver through impact', 'Turn coaching into practice',
    'Build continual improvement']) assert.match(html, rx(m));
  for (const s of ["id:'base'", "id:'control'", "id:'sequence'", "id:'transfer'"]) assert.match(html, rx(s));
  for (const mode of ['Demonstration', 'Animation', 'Reaction', 'Reflection']) assert.match(html, rx(mode));
  assert.match(html, /Press down\. The ground pushes up\./);
  assert.match(html, /Personalised base platform/);
  assert.match(html, /Club-position baseline/);
});

test('coach stays in control: coach view, assignment and progression ledger', () => {
  for (const marker of ['data-role="coach"', 'data-role="golfer"', 'data-action="assign"', 'data-action="advance"',
    'Progression ledger', 'No automated promotion', 'Advancing is your call']) assert.match(html, rx(marker));
  assert.doesNotMatch(html, /Coach hypothesis for Tim to confirm tomorrow/);
});

test('review restores clip-derived visuals and an evidence layer', () => {
  for (const marker of ['data-visual="ground-interaction"', 'data-visual="base-platform"', 'data-visual="club-position"',
    'data-visual="kinematic-sequence"', 'Original SwingKai motion study', 'Science behind the cue',
    'PMID 41653371', 'PMID 35736831', 'PMID 38419912', 'PMID 30698499', 'PMID 22900407', 'PMID 37952707',
    'Supported principle', 'Coach hypothesis']) assert.match(html, rx(marker));
});

test('public review contains no private Tim media and no remote assets', () => {
  assert.doesNotMatch(html, /<video\b/i);
  assert.doesNotMatch(html, /source-intake|20260613_|20260808_|20210427_|20260801_|20260728_/i);
  const remote = [...html.matchAll(/(?:src|href)="(https?:[^"]+)"/g)].map(m => m[1]).filter(u => !u.startsWith('https://pubmed.ncbi.nlm.nih.gov/'));
  assert.deepEqual(remote, []);
});

test('review keeps the five-tab product navigation contract', () => {
  const nav = html.match(/<nav[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? '';
  const tabs = [...nav.matchAll(/data-tab="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(tabs, ['home', 'practice', 'science', 'progress', 'coach']);
});

test('state machine hooks exist and the build claims no measurement it cannot make', () => {
  for (const hook of ['data-action="start-plan"', 'data-action="begin-reps"', 'data-action="complete-rep"', 'data-action="save-session"']) assert.match(html, rx(hook));
  assert.match(html, /No force score from phone video/);
  assert.match(html, /localStorage/);
  assert.doesNotMatch(html, /AI swing score|validated technique score|handicap improvement guaranteed|efficiency %/i);
});

test('mobile preview is installable as a standalone PWA', async () => {
  assert.match(html, /<link rel="manifest" href="\.\/manifest\.webmanifest">/);
  assert.match(html, /<link rel="apple-touch-icon" href="\.\/icons\/apple-touch-icon\.png">/);
  assert.match(html, /navigator\.serviceWorker\.register\('\.\/sw\.js'\)/);
  const manifest = JSON.parse(await readFile(new URL('../manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.name, 'SwingKai');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, './');
  assert.deepEqual(manifest.icons.map(i => i.sizes), ['192x192', '512x512']);
  const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(sw, /manifest\.webmanifest/);
  assert.match(sw, /swingkai-product-preview-v6/);
  assert.doesNotMatch(sw, /source-intake|api\//i);
});
