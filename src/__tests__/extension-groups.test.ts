import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleExtensionGroupTool } from '../tools/extension-groups.js';
import { __resetTokenCacheForTests, runWithCredentials } from '../client.js';
import { mockTokenThenResponse, TEST_CREDS } from './test-helpers.js';

describe('handleExtensionGroupTool', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    __resetTokenCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('yeastar_list_extension_groups hits extension_group/list', async () => {
    mockTokenThenResponse(fetchMock, { errcode: 0, errmsg: 'SUCCESS', data: [] });

    const result = await runWithCredentials(TEST_CREDS, () => handleExtensionGroupTool('yeastar_list_extension_groups', {}));

    expect(new URL(fetchMock.mock.calls[1][0] as string).pathname).toBe('/openapi/v1.0/extension_group/list');
    expect(result.isError).toBeUndefined();
  });

  it('yeastar_get_extension_group hits extension_group/get with id', async () => {
    mockTokenThenResponse(fetchMock, { errcode: 0, errmsg: 'SUCCESS', data: { id: '5' } });

    await runWithCredentials(TEST_CREDS, () => handleExtensionGroupTool('yeastar_get_extension_group', { id: '5' }));

    const url = new URL(fetchMock.mock.calls[1][0] as string);
    expect(url.pathname).toBe('/openapi/v1.0/extension_group/get');
    expect(url.searchParams.get('id')).toBe('5');
  });
});
