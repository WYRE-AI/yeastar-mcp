import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleExtensionTool } from '../tools/extensions.js';
import { __resetTokenCacheForTests, runWithCredentials } from '../client.js';
import { mockTokenThenResponse, TEST_CREDS, textOf } from './test-helpers.js';

describe('handleExtensionTool', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    __resetTokenCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('yeastar_list_extensions forwards pagination and sort params', async () => {
    mockTokenThenResponse(fetchMock, { errcode: 0, errmsg: 'SUCCESS', total_number: 1, data: [{ id: 1, number: '2000' }] });

    const result = await runWithCredentials(TEST_CREDS, () =>
      handleExtensionTool('yeastar_list_extensions', { page: 1, page_size: 20, sort_by: 'number', order_by: 'asc' })
    );

    const url = new URL(fetchMock.mock.calls[1][0] as string);
    expect(url.pathname).toBe('/openapi/v1.0/extension/list');
    expect(url.searchParams.get('page')).toBe('1');
    expect(url.searchParams.get('sort_by')).toBe('number');
    expect(result.isError).toBeUndefined();
  });

  it('yeastar_get_extension passes id and never exposes a password field even if the PBX returned one', async () => {
    mockTokenThenResponse(fetchMock, {
      errcode: 0,
      errmsg: 'SUCCESS',
      data: { id: 1, number: '2000', sip_password: 'should-be-stripped' },
    });

    const result = await runWithCredentials(TEST_CREDS, () => handleExtensionTool('yeastar_get_extension', { id: '1' }));

    const url = new URL(fetchMock.mock.calls[1][0] as string);
    expect(url.pathname).toBe('/openapi/v1.0/extension/get');
    expect(url.searchParams.get('id')).toBe('1');
    expect(textOf(result)).not.toMatch(/should-be-stripped/);
  });
});
