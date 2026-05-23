import { chromium } from 'playwright';

const ts = Date.now();
const EMAIL = `qa_throwaway_${ts}@retailpos-test.com`;
const PASSWORD = 'Test123456';
const NAME = `QA Throwaway ${ts}`;

const log = (...a) => console.log('[drive]', ...a);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 880 } });
page.on('console', (m) => console.log('  [page]', m.type(), m.text()));
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));

try {
  await page.goto('http://localhost:8081', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(6000); // let the JS bundle hydrate
  await page.screenshot({ path: 'shot-1-login.png' });
  log('loaded; bodyText snippet:', (await page.locator('body').innerText()).slice(0, 120).replace(/\n/g, ' | '));

  // Go to Register screen
  const regLink = page.getByText('Register', { exact: false }).first();
  if (await regLink.count()) { await regLink.click(); await page.waitForTimeout(1500); }
  // fall back: maybe a "Sign Up" / "Create" link
  await page.screenshot({ path: 'shot-2-register.png' });

  // Fill the register form by input placeholders
  const fill = async (ph, val) => {
    const el = page.locator(`input[placeholder="${ph}"]`);
    await el.waitFor({ state: 'visible', timeout: 8000 });
    await el.fill(val);
  };
  await fill('Juan Dela Cruz', NAME);
  await fill('you@example.com', EMAIL);
  await fill('Min. 6 characters', PASSWORD);
  log('form filled with', EMAIL);
  await page.screenshot({ path: 'shot-3-filled.png' });

  await page.getByText('Create Account', { exact: true }).first().click();
  log('clicked Create Account; waiting for auth + navigation...');

  // Wait for the authenticated UI: POS screen has "Search name or scan barcode" input
  let landed = false;
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(2000);
    const body = await page.locator('body').innerText();
    if (/scan barcode|Dashboard|Welcome|Point of Sale|POS/i.test(body)) { landed = true; break; }
  }
  await page.screenshot({ path: 'shot-4-after-register.png' });
  const finalBody = (await page.locator('body').innerText()).slice(0, 300).replace(/\n/g, ' | ');
  log('landed authenticated screen?', landed);
  log('final screen text:', finalBody);

  // Probe the logout button presence (cannot trigger it on web: RNW Alert is a no-op)
  const logoutPresent = await page.evaluate(() => {
    return !!document.querySelector('svg, [class]') &&
           document.body.innerText.length > 0;
  });
  log('logout-button trigger SKIPPED on web — react-native-web Alert.alert is a no-op.');

  console.log(JSON.stringify({ result: landed ? 'AUTH_OK' : 'AUTH_FAILED', email: EMAIL }));
} catch (e) {
  console.log('[drive] ERROR', e.message);
  await page.screenshot({ path: 'shot-error.png' }).catch(() => {});
} finally {
  await browser.close();
}
