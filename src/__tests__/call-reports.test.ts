import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleCallReportTool } from '../tools/call-reports.js';
import { __resetTokenCacheForTests, runWithCredentials } from '../client.js';
import { mockTokenThenResponse, TEST_CREDS } from './test-helpers.js';

describe('handleCallReportTool', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    __resetTokenCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('yeastar_list_call_reports hits call_report/list', async () => {
    mockTokenThenResponse(fetchMock, { errcode: 0, errmsg: 'SUCCESS', data: [] });

    const result = await runWithCredentials(TEST_CREDS, () => handleCallReportTool('yeastar_list_call_reports', {}));

    expect(new URL(fetchMock.mock.calls[1][0] as string).pathname).toBe('/openapi/v1.0/call_report/list');
    expect(result.isError).toBeUndefined();
  });
});
