// Responsive + interaction verification. Run `npm start` first, then `npm run verify`.
import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

let require = createRequire(new URL('../package.json', import.meta.url));
try { require.resolve('@playwright/test'); } catch { require = createRequire(new URL('../../Day-06/package.json', import.meta.url)); }
const { chromium } = require('@playwright/test');

const URL_ = process.env.URL || 'http://127.0.0.1:4409/';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
await mkdir('test-results', { recursive: true });
const report = { overflow: [], heroFit: [], checks: [], accessibility: [] };
const failures = [];
const fail = (m) => { failures.push(m); console.error('FAIL', m); };

try {
  // Static rules
  const html = await readFile('index.html', 'utf8');
  const css = await readFile('styles.css', 'utf8');
  if (/font-style\s*:\s*italic/.test(css)) fail('italic type found');
  if (/<em\b/.test(html)) report.checks.push('note: <em> present (styled upright)');

  // 1. Overflow sweep 320 → 1920
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(URL_, { waitUntil: 'networkidle' });
  for (let w = 320; w <= 1920; w += 20) {
    await page.setViewportSize({ width: w, height: w < 800 ? 844 : 1000 });
    await page.waitForTimeout(60);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (over > 0) { report.overflow.push({ w, over }); fail(`overflow ${over}px at ${w}`); }
  }
  if (errors.length) fail('resource/page errors: ' + errors.join(', '));
  report.checks.push(`overflow sweep 320-1920 step 20: ${report.overflow.length ? 'FAIL' : 'pass'}`);

  // 2. Hero fits one screen
  for (const [w, h] of [[390, 844], [414, 896], [360, 740], [1600, 900], [1366, 768], [1280, 720], [1920, 1080], [1440, 900]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(80);
    const r = await page.evaluate(() => {
      const hero = document.querySelector('.hero').getBoundingClientRect();
      const stats = document.querySelector('.hero__stats').getBoundingClientRect();
      const cta = document.querySelector('.hero__cta').getBoundingClientRect();
      const nav = document.querySelector('.nav').getBoundingClientRect();
      const eyebrow = document.querySelector('.hero__eyebrow').getBoundingClientRect();
      return { heroBottom: Math.round(hero.bottom), statsBottom: Math.round(stats.bottom), ctaBottom: Math.round(cta.bottom), statsTop: Math.round(stats.top), navBottom: Math.round(nav.bottom), eyebrowTop: Math.round(eyebrow.top), vh: innerHeight };
    });
    const ok = r.heroBottom <= r.vh && r.ctaBottom <= r.statsTop && r.eyebrowTop >= r.navBottom;
    report.heroFit.push({ w, h, ...r, ok });
    if (!ok) fail(`hero does not fit at ${w}x${h}: ${JSON.stringify(r)}`);
  }

  // 2b. Floating cards and phone screens stay inside their panels at any window shape
  for (const [w, h] of [[1920, 945], [2560, 1080], [3440, 1440], [1366, 768], [1280, 720], [1440, 900]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(120);
    const out = await page.evaluate(() => [...document.querySelectorAll('.ui-progress, .ui-chat, .screen')]
      .filter((o) => getComputedStyle(o).display !== 'none')
      .map((o) => { const pr = o.closest('.panel, .plan__media').getBoundingClientRect(), r = o.getBoundingClientRect(); return { c: o.className.split(' ')[0], ok: r.top >= pr.top + 8 && r.bottom <= pr.bottom - 8 && r.left >= pr.left && r.right <= pr.right }; })
      .filter((x) => !x.ok).map((x) => x.c));
    if (out.length) fail(`overlay clipped by its panel at ${w}x${h}: ${out.join(', ')}`);
  }
  report.checks.push('panel cards and phone screens stay inside their panels (1280×720 to 3440×1440)');

  // 3. Reduced motion renders every section (no element stuck hidden)
  await page.setViewportSize({ width: 1440, height: 900 });
  const hidden = await page.evaluate(async () => {
    const H = document.documentElement.scrollHeight;
    for (let y = 0; y < H; y += 700) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); }
    return [...document.querySelectorAll('main section, main h2, .step, .person, .story, .plan__body')]
      .filter((el) => parseFloat(getComputedStyle(el).opacity) < 0.99 && !el.matches('.story'))
      .map((el) => el.className || el.tagName);
  });
  if (hidden.length) fail('hidden under reduced motion: ' + hidden.join(', '));
  report.checks.push(`reduced motion: ${hidden.length ? 'FAIL' : 'all sections visible'}`);
  await page.close();

  // 4. Text size, target size, broken images, axe — at 390 and 1440
  for (const width of [390, 1440]) {
    const ctx = await browser.newContext({ viewport: { width, height: width < 800 ? 844 : 900 }, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    await p.goto(URL_, { waitUntil: 'networkidle' });
    await p.evaluate(async () => { const H = document.documentElement.scrollHeight; for (let y = 0; y < H; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 25)); } scrollTo(0, 0); });
    await p.waitForTimeout(300);
    const d = await p.evaluate(() => {
      const vis = (el) => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[aria-hidden="true"],.sr-only,.skip-link,[inert],.bar:not(.is-visible)');
      const smallText = [...document.querySelectorAll('body *')].filter((el) => vis(el) && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(el).fontSize) < 12).map((el) => el.textContent.trim().slice(0, 40));
      const smallTargets = [...document.querySelectorAll('a[href],button')].filter(vis).filter((el) => { const r = el.getBoundingClientRect(); return r.width < 43.5 || r.height < 43.5; }).map((el) => (el.textContent.trim() || el.getAttribute('aria-label')).slice(0, 40) + ` ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`);
      const broken = [...document.images].filter((i) => i.complete && !i.naturalWidth).map((i) => i.src);
      return { smallText, smallTargets, broken };
    });
    if (d.smallText.length) fail(`text < 12px at ${width}: ${d.smallText.join(' | ')}`);
    if (d.smallTargets.length) fail(`targets < 44px at ${width}: ${d.smallTargets.join(' | ')}`);
    if (d.broken.length) fail(`broken images at ${width}: ${d.broken.join(', ')}`);
    await p.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
    const ax = await p.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } }));
    report.accessibility.push({ width, violations: ax.violations.map((v) => ({ id: v.id, nodes: v.nodes.length, sample: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) })) });
    if (ax.violations.length) fail(`axe violations at ${width}: ${ax.violations.map((v) => v.id).join(', ')}`);
    await p.screenshot({ path: `test-results/hero-${width}.png` });
    await ctx.close();
  }

  // 5. Motion on: GSAP intro finishes, Lenis loads, nothing stays hidden after scrolling the page
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const mp = await browser.newPage({ viewport: { width: w, height: h }, reducedMotion: 'no-preference' });
    const merr = [];
    mp.on('pageerror', (e) => merr.push(e.message));
    await mp.goto(URL_, { waitUntil: 'networkidle' });
    await mp.waitForTimeout(2600);
    const intro = await mp.evaluate(() => ({
      pending: document.documentElement.classList.contains('anim-pending'),
      h1: getComputedStyle(document.querySelector('.hero h1')).opacity,
      gsap: !!window.gsap, lenis: !!document.querySelector('script[src*="lenis"]')
    }));
    if (intro.pending || intro.h1 !== '1' || !intro.gsap || !intro.lenis) fail(`hero intro at ${w}: ${JSON.stringify(intro)}`);
    const H = await mp.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y <= H; y += 350) { await mp.mouse.wheel(0, 350); await mp.waitForTimeout(90); }
    await mp.waitForTimeout(2200);
    const stuck = await mp.evaluate(() => [...document.querySelectorAll('.step, .panel__copy > *, .faq, .value__table tr, .person, .rail--worn > *, .plan__body > *, .cta h2, .footer__col, .footer__intro, .stories h2')]
      .filter((el) => { const cs = getComputedStyle(el); return cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.99; })
      .map((el) => el.className || el.tagName).slice(0, 8));
    if (stuck.length) fail(`hidden after scrolling with motion at ${w}: ${stuck.join(', ')}`);
    if (merr.length) fail(`page errors with motion at ${w}: ${merr.join(' | ')}`);
    report.checks.push(`motion ${w}px: intro done, Lenis loaded, ${stuck.length ? 'FAIL' : 'all reveals completed'}`);
    await mp.close();
  }

  // 6. Interactions with motion on (Lenis active)
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
  const p = await ctx.newPage();
  await p.goto(URL_, { waitUntil: 'networkidle' });
  await p.waitForTimeout(2600);
  // menu at non-zero scroll keeps position
  await p.evaluate(() => scrollTo(0, 1200)); await p.waitForTimeout(500);
  const before = await p.evaluate(() => Math.round(scrollY));
  await p.locator('.bar [data-menu-open]').click(); await p.waitForTimeout(600);
  assert.equal(await p.locator('#menu').evaluate((m) => m.classList.contains('is-open')), true, 'menu opens');
  await p.mouse.wheel(0, 800); await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => Math.round(scrollY)), before, 'page locked while menu open');
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  assert.equal(await p.locator('#menu').evaluate((m) => m.classList.contains('is-open')), false, 'Escape closes menu');
  assert.equal(await p.evaluate(() => Math.round(scrollY)), before, 'scroll preserved after menu');
  report.checks.push(`menu: opens at scroll ${before}, locks, Escape closes, position preserved`);

  // FAQ accordion
  const q = p.locator('#faq-1a-q');
  await p.evaluate(() => scrollTo(0, document.querySelector('.panels').offsetTop)); await p.waitForTimeout(600);
  await q.click(); await p.waitForTimeout(600);
  assert.equal(await q.getAttribute('aria-expanded'), 'true');
  assert.ok((await p.locator('#faq-1a').evaluate((el) => el.getBoundingClientRect().height)) > 20, 'answer expands');
  await q.click(); assert.equal(await q.getAttribute('aria-expanded'), 'false');
  report.checks.push('FAQ accordion expands and collapses');

  // Panel index navigation
  await p.locator('#panel-1 .panel__index a[href="#panel-3"]').click(); await p.waitForTimeout(1500);
  const p3 = await p.evaluate(() => { const el = document.getElementById('panel-3'); return { top: Math.round(el.getBoundingClientRect().top), stick: parseFloat(getComputedStyle(el).top) }; });
  assert.ok(Math.abs(p3.top - p3.stick) <= 4, `panel 3 lands where it sticks (got ${p3.top}, expected ${p3.stick})`);
  report.checks.push('panel index scrolls to the chosen panel');

  // Stories carousel
  await p.evaluate(() => document.getElementById('stories').scrollIntoView()); await p.waitForTimeout(800);
  await p.locator('#stories .progress__bars button').nth(2).click(); await p.waitForTimeout(1000);
  assert.equal((await p.locator('#stories .progress__count').textContent()).trim(), '3 / 5');
  assert.ok(await p.locator('#stories .story').nth(2).evaluate((el) => el.classList.contains('is-active')));
  report.checks.push('stories carousel navigates');

  // Dialog
  await p.evaluate(() => document.querySelector('.plan__body').scrollIntoView()); await p.waitForTimeout(600);
  await p.locator('.plan__body [data-info="join"]').click(); await p.waitForTimeout(300);
  assert.equal(await p.locator('#info').evaluate((d) => d.open), true);
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  assert.equal(await p.locator('#info').evaluate((d) => d.open), false);
  report.checks.push('info dialog opens and closes with Escape');

  // Signup validation (scroll the footer in first so its reveal plays)
  await p.evaluate(() => document.querySelector('.footer').scrollIntoView()); await p.waitForTimeout(1800);
  await p.locator('.signup button').click();
  assert.match(await p.locator('.signup__msg').textContent(), /valid email/);
  await p.locator('#email').fill('reader@example.com'); await p.locator('.signup button').click();
  assert.match(await p.locator('.signup__msg').textContent(), /Thanks/);
  assert.equal(await p.locator('#email').inputValue(), '');
  report.checks.push('newsletter validates and clears');

  // Marquee half-width rule
  const mq = await p.evaluate(() => { const t = document.querySelector('.marquee__track'); return { half: t.scrollWidth / 2, win: t.parentElement.clientWidth, items: t.children.length }; });
  assert.ok(mq.half >= mq.win && mq.items % 8 === 0 && (mq.items / 8) % 2 === 0, 'marquee track is an even number of sets and half ≥ window');
  report.checks.push(`marquee: ${mq.items} items, half ${Math.round(mq.half)}px ≥ window ${mq.win}px`);
  await ctx.close();

  // 6. Mobile menu
  const m = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await m.goto(URL_, { waitUntil: 'networkidle' });
  await m.locator('.nav [data-menu-open]').click(); await m.waitForTimeout(600);
  assert.ok(await m.locator('#menu .menu__nav a').first().isVisible());
  await m.locator('#menu .menu__nav a[href="#membership"]').click(); await m.waitForTimeout(1600);
  assert.equal(await m.locator('#menu').evaluate((x) => x.classList.contains('is-open')), false);
  const top = await m.evaluate(() => Math.round(document.getElementById('membership').getBoundingClientRect().top));
  assert.ok(top >= 0 && top < 140, `menu link lands on section (top ${top})`);
  await m.screenshot({ path: 'test-results/mobile-after-menu.png' });
  report.checks.push('mobile menu link closes the menu and lands on the section');
  await m.close();
} catch (e) {
  fail(e.message);
} finally {
  await writeFile('test-results/report.json', JSON.stringify({ ...report, failures }, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ ...report, failures }, null, 2));
process.exitCode = failures.length ? 1 : 0;
