import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetTokenCacheForTests,
  getSystemInformation,
  listExtensions,
  runWithCredentials,
  stripSecretFields,
} from '../client.js';
import { jsonResponse, mockTokenThenResponse, TEST_CREDS } from './test-helpers.js';

describe('client token exchange and caching', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    __resetTokenCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exchanges client_id/client_secret for a token via get_token before the first call', async () => {
    mockTokenThenResponse(fetchMock, { errcode: 0, errmsg: 'SUCCESS' });

    await runWithCredentials(TEST_CREDS, () => getSystemInformation(TEST_CREDS));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new URL(tokenUrl).pathname).toBe('/openapi/v1.0/get_token');
    const tokenBody = JSON.parse(tokenInit.body as string);
    // Yeastar's own field names for get_token ARE username/password - see client.ts's comment.
    expect(tokenBody).toEqual({ username: TEST_CREDS.clientId, password: TEST_CREDS.clientSecret });

    const [dataUrl] = fetchMock.mock.calls[1] as [string];
    expect(new URL(dataUrl).pathname).toBe('/openapi/v1.0/system/information');
    expect(new URL(dataUrl).searchParams.get('access_token')).toBe('test-access-token');
  });

  it('reuses a cached token across calls instead of re-authenticating every time', async () => {
    mockTokenThenResponse(fetchMock, { errcode: 0, errmsg: 'SUCCESS' });
    fetchMock.mockResolvedValueOnce(jsonResponse({ errcode: 0, errmsg: 'SUCCESS' }));

    await runWithCredentials(TEST_CREDS, () => getSystemInformation(TEST_CREDS));
    await runWithCredentials(TEST_CREDS, () => getSystemInformation(TEST_CREDS));

    // 1 get_token + 2 data calls = 3, not 4 - the second call's token came from cache.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('treats a normalized bare-host pbxDomain as https', async () => {
    mockTokenThenResponse(fetchMock, { errcode: 0, errmsg: 'SUCCESS' });
    const bareCreds = { ...TEST_CREDS, pbxDomain: 'pbx.example.com:8088' };

    await runWithCredentials(bareCreds, () => getSystemInformation(bareCreds));

    const [tokenUrl] = fetchMock.mock.calls[0] as [string];
    expect(tokenUrl.startsWith('https://pbx.example.com:8088/')).toBe(true);
  });

  it('transparently retries once on errcode 10004 (TOKEN EXPIRED) with a fresh token', async () => {
    mockTokenThenResponse(fetchMock, { errcode: 10004, errmsg: 'TOKEN EXPIRED' });
    // Second token mint + successful retry.
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        errcode: 0,
        errmsg: 'SUCCESS',
        access_token: 'second-token',
        access_token_expire_time: 1800,
        refresh_token: 'r2',
        refresh_token_expire_time: 86400,
      })
    );
    fetchMock.mockResolvedValueOnce(jsonResponse({ errcode: 0, errmsg: 'SUCCESS', data: { model: 'P560' } }));

    const result = await runWithCredentials(TEST_CREDS, () => getSystemInformation(TEST_CREDS));

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect((result as { data: { model: string } }).data.model).toBe('P560');
    const [, , , retryUrl] = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(new URL(retryUrl).searchParams.get('access_token')).toBe('second-token');
  });

  it('throws a readable auth error when the PBX rejects client_id/client_secret', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ errcode: 10005, errmsg: 'ACCESS DENIED' }));

    await expect(runWithCredentials(TEST_CREDS, () => getSystemInformation(TEST_CREDS))).rejects.toThrow(
      /rejected the client credentials/i
    );
  });

  it('surfaces a non-zero application errcode as a readable error, distinct from a transport failure', async () => {
    mockTokenThenResponse(fetchMock, { errcode: 60001, errmsg: 'DATA NOT FOUND' });

    await expect(runWithCredentials(TEST_CREDS, () => getSystemInformation(TEST_CREDS))).rejects.toThrow(
      /errcode 60001/
    );
  });

  it('surfaces an HTTP-level failure distinctly from an application errcode failure', async () => {
    mockTokenThenResponse(fetchMock, { errcode: 0 }, 500);

    await expect(runWithCredentials(TEST_CREDS, () => getSystemInformation(TEST_CREDS))).rejects.toThrow(
      /HTTP 500/
    );
  });

  it('sends page/page_size/sort_by/order_by as query params on a list call', async () => {
    mockTokenThenResponse(fetchMock, { errcode: 0, errmsg: 'SUCCESS', data: [] });

    await runWithCredentials(TEST_CREDS, () =>
      listExtensions(TEST_CREDS, { page: 2, page_size: 10, sort_by: 'number', order_by: 'asc' })
    );

    const [dataUrl] = fetchMock.mock.calls[1] as [string];
    const params = new URL(dataUrl).searchParams;
    expect(params.get('page')).toBe('2');
    expect(params.get('page_size')).toBe('10');
    expect(params.get('sort_by')).toBe('number');
    expect(params.get('order_by')).toBe('asc');
  });
});

describe('stripSecretFields', () => {
  it('drops any key matching /secret|password|pwd/i at any depth', () => {
    const input = {
      id: '1',
      name: 'SIP Trunk',
      register_password: 'shh',
      auth: { secret: 'also-shh', ok: 'fine' },
      nested: [{ pwd: 'nope' }, { keep: 'yes' }],
    };
    expect(stripSecretFields(input)).toEqual({
      id: '1',
      name: 'SIP Trunk',
      auth: { ok: 'fine' },
      nested: [{}, { keep: 'yes' }],
    });
  });

  it('leaves data with no secret-shaped fields unchanged', () => {
    const input = { id: '1', number: '2000' };
    expect(stripSecretFields(input)).toEqual(input);
  });
});
