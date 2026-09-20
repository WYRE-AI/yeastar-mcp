import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleCertificateTool } from '../tools/certificates.js';
import { __resetTokenCacheForTests, runWithCredentials } from '../client.js';
import { mockTokenThenResponse, TEST_CREDS } from './test-helpers.js';

describe('handleCertificateTool', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    __resetTokenCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('yeastar_list_certificates hits certificate/list', async () => {
    mockTokenThenResponse(fetchMock, { errcode: 0, errmsg: 'SUCCESS', data: [{ name: 'default', expiry_date: '2027-01-01' }] });

    const result = await runWithCredentials(TEST_CREDS, () => handleCertificateTool('yeastar_list_certificates', {}));

    expect(new URL(fetchMock.mock.calls[1][0] as string).pathname).toBe('/openapi/v1.0/certificate/list');
    expect(result.isError).toBeUndefined();
  });
});
