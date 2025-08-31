import { test, expect, request } from '@playwright/test';

test('create ticket via API', async () => {
  const api = await request.newContext({ baseURL: 'http://localhost:4000/api' });
  const resp = await api.post('/tickets', {
    data: {
      subject: 'Where is order #1234?',
      body: 'Tracking says delivered but I did not receive it.',
      channel: 'web',
      requester: { email: 'lucas@example.com', name: 'Lucas' }
    }
  });
  expect(resp.ok()).toBeTruthy();
  const ticket = await resp.json();
  expect(ticket.id).toBeTruthy();
  expect(['refund','shipping_issue','billing','general']).toContain(ticket.category);
});
