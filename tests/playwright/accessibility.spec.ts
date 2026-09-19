import { test, expect } from '@playwright/test';

test.describe('AssetTrack - Accessibility', () => {
  test.describe('Dashboard Landmarks', () => {
    test('has proper landmark structure', async ({ page }) => {
      await page.goto('/');

      const nav = page.getByRole('navigation');
      await expect(nav).toBeVisible();

      const main = page.getByRole('main');
      await expect(main).toBeVisible();
    });

    test('navigation contains key links', async ({ page }) => {
      await page.goto('/');

      const nav = page.getByRole('navigation');
      await expect(nav.getByRole('link', { name: /assets/i })).toBeVisible();
      await expect(nav.getByRole('link', { name: /employees/i })).toBeVisible();
    });
  });

  test.describe('Active Navigation State', () => {
    test('marks Dashboard as the current page', async ({ page }) => {
      await page.goto('/');

      const nav = page.getByRole('navigation');
      const homeLink = nav.getByRole('link', { name: /dashboard/i });
      await expect(homeLink).toHaveAttribute('aria-current', 'page');
    });

    test('marks Assets as the current page', async ({ page }) => {
      await page.goto('/assets');

      const nav = page.getByRole('navigation');
      const assetsLink = nav.getByRole('link', { name: /^assets$/i });
      await expect(assetsLink).toHaveAttribute('aria-current', 'page');
    });

    test('marks Employees as the current page', async ({ page }) => {
      await page.goto('/employees');

      const nav = page.getByRole('navigation');
      const employeesLink = nav.getByRole('link', { name: /employees/i });
      await expect(employeesLink).toHaveAttribute('aria-current', 'page');
    });
  });

  test.describe('Keyboard Access', () => {
    test('Assets link is reachable by Tab and activated by Enter', async ({ page }) => {
      await page.goto('/');

      const assetsLink = page.getByRole('navigation').getByRole('link', { name: /^assets$/i });

      // Tab through the page until the Assets link receives focus.
      let focused = false;
      for (let attempt = 0; attempt < 20 && !focused; attempt++) {
        await page.keyboard.press('Tab');
        focused = await assetsLink.evaluate((el) => el === document.activeElement);
      }
      expect(focused).toBe(true);

      await page.keyboard.press('Enter');

      await expect(page).toHaveURL(/\/assets$/);
      await expect(page.getByRole('heading', { level: 1, name: /assets/i })).toBeVisible();
    });
  });

  test.describe('Asset Form Labels', () => {
    test('new asset form fields are reachable by their labels', async ({ page }) => {
      await page.goto('/assets/new');

      await expect(page.getByLabel(/asset tag/i)).toBeVisible();
      await expect(page.getByLabel(/^type$/i)).toBeVisible();
      await expect(page.getByLabel(/manufacturer/i)).toBeVisible();
      await expect(page.getByLabel(/^model$/i)).toBeVisible();
      await expect(page.getByLabel(/serial number/i)).toBeVisible();
    });

    test('new asset form fields are editable via their labels', async ({ page }) => {
      await page.goto('/assets/new');

      const assetTagInput = page.getByLabel(/asset tag/i);
      await assetTagInput.fill('TEST-001');
      await expect(assetTagInput).toHaveValue('TEST-001');

      const manufacturerInput = page.getByLabel(/manufacturer/i);
      await manufacturerInput.fill('Test Manufacturer');
      await expect(manufacturerInput).toHaveValue('Test Manufacturer');
    });
  });

  test.describe('Asset List Filters', () => {
    test('search filter is reachable by its label', async ({ page }) => {
      await page.goto('/assets');

      const searchInput = page.getByLabel(/search tag.*manufacturer.*model/i);
      await searchInput.fill('laptop');
      await expect(searchInput).toHaveValue('laptop');
    });

    test('type filter is an accessible combobox', async ({ page }) => {
      await page.goto('/assets');

      const typeFilter = page.getByLabel(/^type$/i);
      await expect(typeFilter).toBeVisible();
      await expect(typeFilter).toHaveRole('combobox');
    });
  });
});
