import { expect, test, type Page } from '@playwright/test';
import words from '../data/words.json' with { type: 'json' };

const defs = words.words as Record<string, { definitionFr: string }>;

/** « Vérifier » puis « Continuer » : on attend que la barre de feedback soit montée entre les deux. */
async function checkThenContinue(page: Page) {
  await page.keyboard.press('Enter');
  await page.locator('[aria-live] button[tabindex="0"]').waitFor();
  await page.keyboard.press('Enter');
  await page.locator('[aria-live] button[tabindex="0"]').waitFor({ state: 'detached' });
}

/** Joue une leçon complète au clavier : la 1re option à chaque QCM (souvent fausse, donc les erreurs reviennent). */
async function playLesson(page: Page) {
  for (let step = 0; step < 150; step++) {
    if (await page.getByText('Leçon terminée').count()) return;
    const main = page.locator('main');
    if (!(await main.count())) {
      await page.waitForTimeout(100);
      continue;
    }
    const text = (await main.innerText()).toLowerCase(); // les titres sont en majuscules via CSS
    if (text.includes('nouveau mot')) {
      await page.keyboard.press('Enter');
    } else if (text.includes('associe les paires')) {
      const lefts = page.locator('main .grid > div:nth-child(1) > button');
      const names = await lefts.allInnerTexts();
      for (const w of names) {
        await page.locator('main .grid > div:nth-child(1) > button', { hasText: new RegExp(`^${w}$`) }).click();
        await page.locator('main .grid > div:nth-child(2) > button', { hasText: defs[w.replace(' ', '-')].definitionFr }).first().click();
      }
      await page.locator('[aria-live] button[tabindex="0"]').waitFor();
      await page.keyboard.press('Enter');
      await page.locator('[aria-live] button[tabindex="0"]').waitFor({ state: 'detached' });
    } else if (await page.locator('main input').count()) {
      const definition = (await page.locator('main p').first().innerText()).trim();
      const entry = Object.values(words.words as Record<string, { word: string; definition: string }>).find((w) => w.definition === definition);
      await page.fill('main input', entry?.word ?? 'zzz');
      await checkThenContinue(page);
    } else if (text.includes('choisis 2 mots')) {
      await page.keyboard.press('1');
      await page.keyboard.press('2');
      await checkThenContinue(page);
    } else if (await page.locator('main button[class*="border-b-4"]').count()) {
      await page.keyboard.press('1');
      await checkThenContinue(page);
    }
    await page.waitForTimeout(60);
  }
  throw new Error(`la leçon ne se termine pas. Écran : ${(await page.locator('body').innerText()).slice(0, 400)}`);
}

test('accueil : 21 chapitres, aucun défilement horizontal à 360 px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'GREmlin' })).toBeVisible();
  await expect(page.locator('section button')).toHaveCount(21);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('leçon complète : une erreur revient, la progression est enregistrée, la série démarre', async ({ page }) => {
  await page.goto('/');
  await page.locator('section button').first().click();
  await page.getByText('Commencer une leçon').click();
  await playLesson(page);
  await expect(page.getByText('de bonnes réponses du premier coup')).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('gre-progress-v1')!));
  expect(Object.keys(saved.words).length).toBeGreaterThanOrEqual(4);
  expect(saved.streak.count).toBe(1);
  expect(Object.values<{ lessons: number }>(saved.days)[0].lessons).toBe(1);
});

test('tri : « je connais » passe le mot en boîte 4, annuler le remet à zéro', async ({ page }) => {
  await page.goto('/');
  await page.locator('section button').first().click();
  await page.getByText('Trier les mots').click();
  await page.keyboard.press('ArrowRight');
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('gre-progress-v1')!));
  expect(saved.words.adept).toMatchObject({ box: 4, known: true });
  await page.getByRole('button', { name: 'Annuler' }).click();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('gre-progress-v1')!));
  expect(saved.words.adept).toBeUndefined();
});

test('reprise : recharger en pleine leçon propose de la reprendre', async ({ page }) => {
  await page.goto('/');
  await page.locator('section button').first().click();
  await page.getByText('Commencer une leçon').click();
  await page.getByText('Nouveau mot').waitFor();
  await page.keyboard.press('Enter');
  await page.reload();
  await page.getByText('Reprendre ma leçon').click();
  await expect(page.locator('footer')).toBeVisible();
});

test('recherche : trouve un mot par sa traduction et ouvre sa fiche', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Rechercher un mot').fill('hasard');
  await expect(page.getByRole('button', { name: /happenstance/ })).toBeVisible();
  await page.getByRole('button', { name: /happenstance/ }).click();
  await expect(page.getByRole('dialog')).toContainText('a chance circumstance');
});

test('réglages : le thème sombre s\'applique et persiste', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Réglages' }).click();
  await page.getByRole('radio', { name: 'Sombre' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('statistiques : s\'affichent sans progression', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Statistiques' }).click();
  await expect(page.getByRole('heading', { name: 'Statistiques' })).toBeVisible();
  await expect(page.getByRole('img', { name: /Mots maîtrisés sur 30 jours/ })).toBeVisible();
});

test('PWA : manifeste valide, service worker actif, rechargement hors ligne', async ({ page, context }) => {
  await page.goto('/');
  const manifest = await page.evaluate(() => fetch('/manifest.webmanifest').then((r) => r.json()));
  expect(manifest.name).toBe('GREmlin');
  expect(manifest.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBe(true);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload(); // le worker contrôle la page
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'GREmlin' })).toBeVisible();
});

test('révision de mots avancés : écriture, équivalence à 2 réponses, écoute… la leçon se termine sans erreur', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const ids = ['adept', 'advocate', 'affluent', 'arresting', 'candid', 'catholic', 'censure', 'chauvinism'];
    const wordsProgress = Object.fromEntries(ids.map((id) => [id, { box: 4, dueAt: 1, seen: 3, misses: 0 }]));
    localStorage.setItem('gre-progress-v1', JSON.stringify({ words: wordsProgress, streak: { count: 0, lastDay: null }, sound: true, days: {} }));
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Réviser \(8 mots dus\)/ }).click();
  await playLesson(page);
  expect(errors).toEqual([]);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('gre-progress-v1')!));
  expect(saved.words.adept.seen).toBe(4);
});
