import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ args: ['--enable-webgl', '--use-angle=swiftshader'] });
const context = await browser.newContext({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true });
const captured = [];
let rejectAnalytics = false;
await context.route('https://us.i.posthog.com/i/v0/e/', async (route) => {
  if (rejectAnalytics) return route.abort('failed');
  captured.push(route.request().postDataJSON());
  return route.fulfill({ status: 200, body: '{}' });
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

async function scene(key) {
  await page.waitForFunction((expected) => window.__ISPY_QA__?.activeScenes().includes(expected), key);
}
async function tap(sceneKey, control) {
  const point = await page.evaluate(([key, name]) => window.__ISPY_QA__.buttonCenter(key, name), [sceneKey, control]);
  assert.ok(point, `${sceneKey}.${control} exists`);
  await page.touchscreen.tap(point.x, point.y);
}

try {
  await page.goto('http://127.0.0.1:4173/?qa=1&mode=LOCATE&seed=ANALYTICS-QA');
  await scene('StartIntro');
  await page.evaluate(() => window.__ISPY_QA__.finishIntro());
  await scene('MainMenu');
  await tap('MainMenu', 'randomCard');
  await scene('MissionBriefing');
  await tap('MissionBriefing', 'begin');
  await scene('Recon');
  // The game's own timer calls this transition; accelerate its expiry for a deterministic result.
  await page.evaluate(() => window.__ISPY_QA__.game.scene.getScene('Recon').finishMission(false));
  await scene('Results');
  await page.waitForTimeout(400);
  const events = captured.map((item) => item.event);
  for (const name of ['game_opened', 'game_started', 'round_started', 'round_completed', 'game_over']) {
    assert.equal(events.filter((event) => event === name).length, 1, name);
  }
  assert.ok(captured.every((item) => item.properties.brand === 'inspire' && item.properties.game === 'I-SPY'));
  assert.ok(captured.every((item) => item.properties.$process_person_profile === false && item.properties.$geoip_disable === true));
  assert.equal(new Set(captured.map((item) => item.distinct_id)).size, 1);
  assert.equal(captured.find((item) => item.event === 'game_over').properties.score >= 0, true);
  assert.equal(errors.length, 0, errors.join(' | '));

  rejectAnalytics = true;
  await page.reload();
  await scene('StartIntro');
  await page.evaluate(() => window.__ISPY_QA__.finishIntro());
  await scene('MainMenu');
  assert.equal(errors.length, 0, errors.join(' | '));
  console.log(`ANALYTICS_QA_CAPTURE ${JSON.stringify(captured)}`);
  console.log('I-SPY analytics browser QA passed.');
} finally {
  await browser.close();
}
