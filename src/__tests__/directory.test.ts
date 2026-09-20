import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleDirectoryTool } from '../tools/directory.js';
import { __resetTokenCacheForTests, runWithCredentials } from '../client.js';
import { mockTokenThenResponse, TEST_CREDS } from './test-helpers.js';

describe('handleDirectoryTool', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    __resetTokenCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('yeastar_list_company_contacts hits company_contact/list', async () => {
    mockTokenThenResponse(fetchMock, { errcode: 0, errmsg: 'SUCCESS', data: [] });

    const result = await runWithCredentials(TEST_CREDS, () => handleDirectoryTool('yeastar_list_company_contacts', {}));

    expect(new URL(fetchMock.mock.calls[1][0] as string).pathname).toBe('/openapi/v1.0/company_contact/list');
    expect(result.isError).toBeUndefined();
  });
});
