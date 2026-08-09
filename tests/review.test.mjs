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
