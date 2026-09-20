import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleIvrTool } from '../tools/ivr.js';
import { __resetTokenCacheForTests, runWithCredentials } from '../client.js';
import { mockTokenThenResponse, TEST_CREDS } from './test-helpers.js';

describe('handleIvrTool', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    __resetTokenCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('yeastar_list_ivrs hits ivr/list', async () => {
    mockTokenThenResponse(fetchMock, { errcode: 0, errmsg: 'SUCCESS', data: [] });
    await runWithCredentials(TEST_CREDS, () => handleIvrTool('yeastar_list_ivrs', {}));
    expect(new URL(fetchMock.mock.calls[1][0] as string).pathname).toBe('/openapi/v1.0/ivr/list');
  });

  it('yeastar_get_ivr hits ivr/get with id', async () => {
    mockTokenThenResponse(fetchMock, { errcode: 0, errmsg: 'SUCCESS', data: {} });
    await runWithCredentials(TEST_CREDS, () => handleIvrTool('yeastar_get_ivr', { id: '3' }));
    const url = new URL(fetchMock.mock.calls[1][0] as string);
    expect(url.pathname).toBe('/openapi/v1.0/ivr/get');
    expect(url.searchParams.get('id')).toBe('3');
  });
});
