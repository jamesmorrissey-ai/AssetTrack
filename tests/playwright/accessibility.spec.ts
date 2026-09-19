import { test, expect } from '@playwright/test';

async function tabTo(page: import('@playwright/test').Page, target: import('@playwright/test').Locator) {
  for (let attempt = 0; attempt < 30; attempt++) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((element) => element === document.activeElement)) {
      return;
    }
  }

  throw new Error(`Could not reach ${await target.getAttribute('href') ?? await target.getAttribute('name') ?? 'control'} by Tab`);
}

test.describe('AssetTrack - Accessibility', () => {
  test.describe('Dashboard Landmarks', () => {
    test('has proper landmark structure', async ({ page }) => {
      await page.goto('/');

      const nav = page.getByRole('navigation');
      await expect(nav).toBeVisible();

      const main = page.getByRole('main');
      await expect(main).toBeVisible();
    });

    test('has a logical heading hierarchy and accessible summary links', async ({ page }) => {
      await page.goto('/');

      const main = page.getByRole('main');
      await expect(main.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
      await expect(main.getByRole('heading', { level: 2, name: 'Assets by status' })).toBeVisible();
      await expect(main.getByRole('heading', { level: 1 })).toHaveCount(1);

      await expect(main.getByRole('link', { name: /total assets/i })).toBeVisible();
      await expect(main.getByRole('link', { name: /^employees/i })).toBeVisible();
      await expect(main.getByRole('link', { name: /^utilization/i })).toBeVisible();
      await expect(main.getByRole('link', { name: /^lost \/ retired/i })).toBeVisible();
    });

    test('dashboard content links follow a logical keyboard focus order', async ({ page }) => {
      await page.goto('/');

      const main = page.getByRole('main');
      const summaryLinks = [
        main.getByRole('link', { name: /total assets/i }),
        main.getByRole('link', { name: /^employees/i }),
        main.getByRole('link', { name: /^utilization/i }),
        main.getByRole('link', { name: /^lost \/ retired/i }),
      ];

      await tabTo(page, summaryLinks[0]);
      for (const link of summaryLinks.slice(1)) {
        await page.keyboard.press('Tab');
        await expect(link).toBeFocused();
      }
    });
  });

  test.describe('Active Navigation State', () => {
    const destinations = [
      { name: 'Dashboard', path: '/', heading: 'Dashboard' },
      { name: 'Assets', path: '/assets', heading: 'Assets' },
      { name: 'Employees', path: '/employees', heading: 'Employees' },
      { name: 'Assignments', path: '/assignments', heading: 'Assignments' },
      { name: 'Reports', path: '/reports', heading: 'Reports' },
    ];

    for (const destination of destinations) {
      test(`${destination.name} is keyboard-accessible and becomes current`, async ({ page }) => {
        await page.goto('/');

        const target = page.getByRole('navigation').getByRole('link', { name: destination.name, exact: true });
        await tabTo(page, target);
        await page.keyboard.press('Enter');

        await expect(page).toHaveURL(new RegExp(`${destination.path === '/' ? '/$' : `${destination.path}$`}`));
        const nav = page.getByRole('navigation');
        await expect(nav).toBeVisible();
        await expect(nav.getByRole('link', { name: destination.name, exact: true })).toHaveAttribute('aria-current', 'page');
        await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
        await expect(page.getByRole('heading', { level: 1, name: destination.heading })).toBeVisible();
      });
    }

    test('nav links occur in the expected keyboard focus order', async ({ page }) => {
      await page.goto('/');

      const nav = page.getByRole('navigation');
      const orderedLinks = ['AssetTrack', 'Dashboard', 'Assets', 'Employees', 'Assignments', 'Reports']
        .map((name) => nav.getByRole('link', { name, exact: true }));

      await tabTo(page, orderedLinks[0]);
      for (const link of orderedLinks.slice(1)) {
        await page.keyboard.press('Tab');
        await expect(link).toBeFocused();
      }
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
      await expect(page.getByLabel(/^status$/i)).toBeVisible();
      await expect(page.getByLabel(/purchase date/i)).toBeVisible();
      await expect(page.getByLabel(/warranty expiry/i)).toBeVisible();
      await expect(page.getByLabel(/notes/i)).toBeVisible();
    });

    test('remaining new asset fields are keyboard-editable', async ({ page }) => {
      await page.goto('/assets/new');

      const status = page.getByLabel(/^status$/i);
      await tabTo(page, status);
      await page.keyboard.press('ArrowDown');
      await expect(status).toHaveValue('assigned');

      const purchaseDate = page.getByLabel(/purchase date/i);
      await tabTo(page, purchaseDate);
      await purchaseDate.fill('2026-01-15');
      await expect(purchaseDate).toHaveValue('2026-01-15');

      const warrantyExpiry = page.getByLabel(/warranty expiry/i);
      await tabTo(page, warrantyExpiry);
      await expect(warrantyExpiry).toBeFocused();
      await warrantyExpiry.fill('2028-01-15');
      await expect(warrantyExpiry).toHaveValue('2028-01-15');

      const notes = page.getByLabel(/notes/i);
      await tabTo(page, notes);
      await expect(notes).toBeFocused();
      await page.keyboard.type('Keyboard-entered notes');
      await expect(notes).toHaveValue('Keyboard-entered notes');
    });

    test('Create has an accessible name and is keyboard-activatable', async ({ page }) => {
      await page.goto('/assets/new');

      await page.getByLabel(/asset tag/i).fill('CON-LPT-001');
      await page.getByLabel(/^type$/i).selectOption('Laptop');
      await page.getByLabel(/manufacturer/i).fill('Duplicate');
      await page.getByLabel(/^model$/i).fill('Duplicate');

      const submit = page.getByRole('button', { name: 'Create' });
      await tabTo(page, submit);
      await expect(submit).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.getByText(/500 .*assets/i)).toBeVisible();
    });

    test('create failures are exposed as an alert', async ({ page }) => {
      test.fail(true, 'Known accessibility gap: the create error uses Bootstrap styling without role="alert".');
      await page.goto('/assets/new');

      await page.getByLabel(/asset tag/i).fill('CON-LPT-001');
      await page.getByLabel(/^type$/i).selectOption('Laptop');
      await page.getByLabel(/manufacturer/i).fill('Duplicate');
      await page.getByLabel(/^model$/i).fill('Duplicate');
      await page.getByRole('button', { name: 'Create' }).press('Enter');

      await expect(page.getByRole('alert')).toContainText(/500 .*assets/i);
    });
  });

  test.describe('Asset List Filters', () => {
    test('filters and search are keyboard-operable', async ({ page }) => {
      await page.goto('/assets');

      const typeFilter = page.getByLabel(/^type$/i);
      await tabTo(page, typeFilter);
      await expect(typeFilter).toHaveRole('combobox');
      await page.keyboard.press('ArrowDown');
      await expect(typeFilter).toHaveValue('Laptop');

      const statusFilter = page.getByLabel(/^status$/i);
      await page.keyboard.press('Tab');
      await expect(statusFilter).toBeFocused();
      await expect(statusFilter).toHaveRole('combobox');
      await page.keyboard.press('ArrowDown');
      await expect(statusFilter).toHaveValue('available');

      const searchInput = page.getByLabel(/search tag.*manufacturer.*model/i);
      await page.keyboard.press('Tab');
      await expect(searchInput).toBeFocused();
      await page.keyboard.type('temporary');
      await expect(searchInput).toHaveValue('temporary');
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.press('Backspace');
      await page.keyboard.type('Proseware');
      await expect(searchInput).toHaveValue('Proseware');

      const filterButton = page.getByRole('button', { name: 'Filter' });
      await page.keyboard.press('Tab');
      await expect(filterButton).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/type=Laptop&status=available&q=Proseware/);

      const clearLink = page.getByRole('link', { name: 'Clear' });
      await expect(clearLink).toBeVisible();
      await tabTo(page, clearLink);
      await expect(clearLink).toBeFocused();
    });

    test('results use table, row, and columnheader semantics', async ({ page }) => {
      await page.goto('/assets');

      const table = page.getByRole('table');
      await expect(table).toBeVisible();
      await expect(table.getByRole('columnheader')).toHaveCount(5);
      expect(await table.getByRole('row').count()).toBeGreaterThan(1);
    });
  });
});
