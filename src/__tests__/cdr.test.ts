import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleCdrTool } from '../tools/cdr.js';
import { __resetTokenCacheForTests, runWithCredentials } from '../client.js';
import { mockTokenThenResponse, TEST_CREDS } from './test-helpers.js';

describe('handleCdrTool', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    __resetTokenCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('yeastar_list_cdr hits cdr/list and forwards the time bounds', async () => {
    mockTokenThenResponse(fetchMock, { errcode: 0, errmsg: 'SUCCESS', data: [] });

    const result = await runWithCredentials(TEST_CREDS, () =>
      handleCdrTool('yeastar_list_cdr', { start_time: '2026-09-01 00:00:00', end_time: '2026-09-20 00:00:00' })
    );

    const url = new URL(fetchMock.mock.calls[1][0] as string);
    expect(url.pathname).toBe('/openapi/v1.0/cdr/list');
    expect(url.searchParams.get('start_time')).toBe('2026-09-01 00:00:00');
    expect(url.searchParams.get('end_time')).toBe('2026-09-20 00:00:00');
    expect(result.isError).toBeUndefined();
  });
});
