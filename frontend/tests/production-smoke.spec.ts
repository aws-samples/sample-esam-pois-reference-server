// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { expect, test } from '@playwright/test';

test('production bundle loads with working persistence and static assets', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.route('**/api/auth/config', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        userPoolId: 'us-east-1_example',
        userPoolClientId: 'example',
      }),
    })
  );

  const response = await page.goto('/');
  expect(response?.ok()).toBe(true);
  await expect(page.getByRole('heading', { name: 'POIS Reference Server' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();

  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('persist:pois-auth')))
    .not.toBeNull();

  const faviconResponse = await page.request.get('/favicon.svg');
  expect(faviconResponse.ok()).toBe(true);

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
