import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleSystemTool } from '../tools/system.js';
import { __resetTokenCacheForTests, runWithCredentials } from '../client.js';
import { mockTokenThenResponse, TEST_CREDS, textOf } from './test-helpers.js';

describe('handleSystemTool', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    __resetTokenCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('yeastar_get_system_information hits system/information', async () => {
    mockTokenThenResponse(fetchMock, { errcode: 0, errmsg: 'SUCCESS', data: { model: 'P560', firmware_version: '37.7.0.16' } });

    const result = await runWithCredentials(TEST_CREDS, () => handleSystemTool('yeastar_get_system_information', {}));

    expect(result.isError).toBeUndefined();
    expect(new URL(fetchMock.mock.calls[1][0] as string).pathname).toBe('/openapi/v1.0/system/information');
    expect(JSON.parse(textOf(result)).data.model).toBe('P560');
  });

  it('yeastar_get_system_capacity hits system/capacity', async () => {
    mockTokenThenResponse(fetchMock, { errcode: 0, errmsg: 'SUCCESS', data: { extension_used: 12, extension_total: 50 } });

    const result = await runWithCredentials(TEST_CREDS, () => handleSystemTool('yeastar_get_system_capacity', {}));

    expect(new URL(fetchMock.mock.calls[1][0] as string).pathname).toBe('/openapi/v1.0/system/capacity');
    expect(JSON.parse(textOf(result)).data.extension_total).toBe(50);
  });

  it('returns a credential error without calling fetch when no credentials are configured', async () => {
    const result = await handleSystemTool('yeastar_get_system_information', {});

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/YEASTAR_PBX_DOMAIN/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
