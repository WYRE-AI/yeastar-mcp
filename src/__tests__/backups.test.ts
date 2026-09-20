import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleBackupTool } from '../tools/backups.js';
import { __resetTokenCacheForTests, runWithCredentials } from '../client.js';
import { mockTokenThenResponse, TEST_CREDS } from './test-helpers.js';

describe('handleBackupTool', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    __resetTokenCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('yeastar_list_backups hits backup/list', async () => {
    mockTokenThenResponse(fetchMock, { errcode: 0, errmsg: 'SUCCESS', data: [{ name: 'nightly.tar.gz', created_time: '2026-09-20 02:00:00' }] });

    const result = await runWithCredentials(TEST_CREDS, () => handleBackupTool('yeastar_list_backups', {}));

    expect(new URL(fetchMock.mock.calls[1][0] as string).pathname).toBe('/openapi/v1.0/backup/list');
    expect(result.isError).toBeUndefined();
  });
});
