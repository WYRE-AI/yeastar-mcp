import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleTrunkTool } from '../tools/trunks.js';
import { __resetTokenCacheForTests, runWithCredentials } from '../client.js';
import { mockTokenThenResponse, TEST_CREDS, textOf } from './test-helpers.js';

describe('handleTrunkTool', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    __resetTokenCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('yeastar_list_trunks hits trunk/list', async () => {
    mockTokenThenResponse(fetchMock, { errcode: 0, errmsg: 'SUCCESS', data: [] });

    const result = await runWithCredentials(TEST_CREDS, () => handleTrunkTool('yeastar_list_trunks', {}));

    expect(new URL(fetchMock.mock.calls[1][0] as string).pathname).toBe('/openapi/v1.0/trunk/list');
    expect(result.isError).toBeUndefined();
  });

  it('yeastar_get_trunk strips register_password/auth secrets from the response', async () => {
    mockTokenThenResponse(fetchMock, {
      errcode: 0,
      errmsg: 'SUCCESS',
      data: { id: '1', name: 'Main Trunk', register_password: 'shh', auth_secret: 'also-shh' },
    });

    const result = await runWithCredentials(TEST_CREDS, () => handleTrunkTool('yeastar_get_trunk', { id: '1' }));

    const text = textOf(result);
    expect(text).not.toMatch(/shh/);
    expect(text).toMatch(/Main Trunk/);
  });

  it('yeastar_list_itsp_trunks hits trunk/itsp_list', async () => {
    mockTokenThenResponse(fetchMock, { errcode: 0, errmsg: 'SUCCESS', data: [] });

    await runWithCredentials(TEST_CREDS, () => handleTrunkTool('yeastar_list_itsp_trunks', {}));

    expect(new URL(fetchMock.mock.calls[1][0] as string).pathname).toBe('/openapi/v1.0/trunk/itsp_list');
  });
});
