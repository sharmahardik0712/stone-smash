// Mobile smoke test: start a run, drag, see the score increase, reach game over, restart.
// Uses the ?debug=1 hooks (window.__game, window.__stoneSmash). Run with `npm run test:e2e`.

import { expect, test, type Page } from '@playwright/test';

const W = 720;

/**
 * Converts playfield coordinates (720x1280) to page coordinates. The canvas may be taller than
 * 1280 on tall phones; the active scene's camera scroll says where the playfield sits.
 */
async function toPage(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  const box = (await page.locator('canvas').boundingBox())!;
  const { height, scrollY } = await page.evaluate(() => {
    const g = (
      window as unknown as {
        __game: {
          scale: { height: number };
          scene: { getScenes(a: boolean): { cameras: { main: { scrollY: number } } }[] };
        };
      }
    ).__game;
    const scenes = g.scene.getScenes(true);
    return { height: g.scale.height, scrollY: scenes[scenes.length - 1].cameras.main.scrollY };
  });
  const sy = y - scrollY;
  return { x: box.x + (x / W) * box.width, y: box.y + (sy / height) * box.height };
}

async function tap(page: Page, x: number, y: number): Promise<void> {
  const p = await toPage(page, x, y);
  await page.touchscreen.tap(p.x, p.y);
}

async function activeScenes(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    (
      window as unknown as {
        __game: { scene: { getScenes(a: boolean): { sys: { settings: { key: string } } }[] } };
      }
    ).__game.scene
      .getScenes(true)
      .map((s) => s.sys.settings.key),
  );
}

test('play, drag, score, game over, restart', async ({ page }) => {
  await page.goto('/?debug=1');
  await page.locator('canvas').waitFor();
  await expect.poll(() => activeScenes(page)).toContain('Menu');

  await tap(page, 360, 800); // PLAY
  await expect.poll(() => activeScenes(page)).toContain('Game');

  // Drag in the bottom 40% of the screen.
  const from = await toPage(page, 360, 1000);
  const to = await toPage(page, 200, 1000);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();

  // The first stone falls down the middle; auto-fire breaks it.
  const score = () =>
    page.evaluate(
      () =>
        (
          window as unknown as { __stoneSmash: { world(): { score: { score: number } } } }
        ).__stoneSmash.world().score.score,
    );
  await tap(page, 360, 1000);
  await expect.poll(score, { timeout: 20_000 }).toBeGreaterThan(0);

  await page.evaluate(() =>
    (window as unknown as { __stoneSmash: { forceGameOver(): void } }).__stoneSmash.forceGameOver(),
  );
  await expect.poll(() => activeScenes(page), { timeout: 10_000 }).toContain('GameOver');

  await tap(page, 360, 880); // Play again
  await expect.poll(() => activeScenes(page)).toContain('Game');
});
