import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleRouteTool } from '../tools/routes.js';
import { __resetTokenCacheForTests, runWithCredentials } from '../client.js';
import { mockTokenThenResponse, TEST_CREDS } from './test-helpers.js';

describe('handleRouteTool', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    __resetTokenCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('yeastar_list_inbound_routes hits inbound_route/list', async () => {
    mockTokenThenResponse(fetchMock, { errcode: 0, errmsg: 'SUCCESS', data: [] });
    await runWithCredentials(TEST_CREDS, () => handleRouteTool('yeastar_list_inbound_routes', {}));
    expect(new URL(fetchMock.mock.calls[1][0] as string).pathname).toBe('/openapi/v1.0/inbound_route/list');
  });

  it('yeastar_get_inbound_route hits inbound_route/get with id', async () => {
    mockTokenThenResponse(fetchMock, { errcode: 0, errmsg: 'SUCCESS', data: {} });
    await runWithCredentials(TEST_CREDS, () => handleRouteTool('yeastar_get_inbound_route', { id: '7' }));
    const url = new URL(fetchMock.mock.calls[1][0] as string);
    expect(url.pathname).toBe('/openapi/v1.0/inbound_route/get');
    expect(url.searchParams.get('id')).toBe('7');
  });

  it('yeastar_list_outbound_routes hits outbound_route/list', async () => {
    mockTokenThenResponse(fetchMock, { errcode: 0, errmsg: 'SUCCESS', data: [] });
    await runWithCredentials(TEST_CREDS, () => handleRouteTool('yeastar_list_outbound_routes', {}));
    expect(new URL(fetchMock.mock.calls[1][0] as string).pathname).toBe('/openapi/v1.0/outbound_route/list');
  });

  it('yeastar_get_outbound_route hits outbound_route/get with id', async () => {
    mockTokenThenResponse(fetchMock, { errcode: 0, errmsg: 'SUCCESS', data: {} });
    await runWithCredentials(TEST_CREDS, () => handleRouteTool('yeastar_get_outbound_route', { id: '9' }));
    const url = new URL(fetchMock.mock.calls[1][0] as string);
    expect(url.pathname).toBe('/openapi/v1.0/outbound_route/get');
    expect(url.searchParams.get('id')).toBe('9');
  });
});
