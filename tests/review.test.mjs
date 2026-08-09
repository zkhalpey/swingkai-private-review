import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('App Store demo exposes a complete golfer journey', () => {
  for (const marker of [
    'Good morning, Zain',
    'Start today’s session',
    'Your lesson plan',
    'Guided practice',
    'Mark rep complete',
    'Session complete',
    'Your progress',
    'Coach feedback',
    'Kinetic Swing System',
    'Personalised base platform',
    'Three-arch foot tripod',
    'Press down. The ground pushes up.',
    'Club-position baseline',
    'Illustrative demo data',
  ]) {
    assert.match(html, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('public review contains no private Tim media', () => {
  assert.doesNotMatch(html, /<video\b/i);
  assert.doesNotMatch(html, /source-intake|20260613_|20260808_|20210427_|20260801_|20260728_/i);
});

test('review keeps the four-tab product navigation contract', () => {
  const nav = html.match(/<nav[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? '';
  const tabs = [...nav.matchAll(/data-tab="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(tabs, ['home', 'practice', 'progress', 'coach']);
});

test('demo includes working state-machine hooks without claiming measurement', () => {
  for (const hook of ['data-action="start-plan"', 'data-action="begin-reps"', 'data-action="complete-rep"']) {
    assert.match(html, new RegExp(hook));
  }
  assert.match(html, /No force score from phone video/);
  assert.doesNotMatch(html, /AI swing score|validated technique score|handicap improvement guaranteed/i);
});

test('mobile preview is installable as a standalone PWA', async () => {
  assert.match(html, /<link rel="manifest" href="\.\/manifest\.webmanifest">/);
  assert.match(html, /<link rel="apple-touch-icon" href="\.\/icons\/apple-touch-icon\.png">/);
  assert.match(html, /navigator\.serviceWorker\.register\('\.\/sw\.js'\)/);

  const manifest = JSON.parse(await readFile(new URL('../manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.name, 'SwingKai');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, './');
  assert.deepEqual(manifest.icons.map(icon => icon.sizes), ['192x192', '512x512']);

  const serviceWorker = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(serviceWorker, /manifest\.webmanifest/);
  assert.doesNotMatch(serviceWorker, /source-intake|api\//i);
});
