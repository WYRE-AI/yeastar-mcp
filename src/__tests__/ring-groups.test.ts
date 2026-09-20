import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleRingGroupTool } from '../tools/ring-groups.js';
import { __resetTokenCacheForTests, runWithCredentials } from '../client.js';
import { mockTokenThenResponse, TEST_CREDS } from './test-helpers.js';

describe('handleRingGroupTool', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    __resetTokenCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('yeastar_list_ring_groups hits ringgroup/list', async () => {
    mockTokenThenResponse(fetchMock, { errcode: 0, errmsg: 'SUCCESS', data: [] });
    await runWithCredentials(TEST_CREDS, () => handleRingGroupTool('yeastar_list_ring_groups', {}));
    expect(new URL(fetchMock.mock.calls[1][0] as string).pathname).toBe('/openapi/v1.0/ringgroup/list');
  });

  it('yeastar_get_ring_group hits ringgroup/get with id', async () => {
    mockTokenThenResponse(fetchMock, { errcode: 0, errmsg: 'SUCCESS', data: {} });
    await runWithCredentials(TEST_CREDS, () => handleRingGroupTool('yeastar_get_ring_group', { id: '4' }));
    const url = new URL(fetchMock.mock.calls[1][0] as string);
    expect(url.pathname).toBe('/openapi/v1.0/ringgroup/get');
    expect(url.searchParams.get('id')).toBe('4');
  });
});
