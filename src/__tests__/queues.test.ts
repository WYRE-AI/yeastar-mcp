import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleQueueTool } from '../tools/queues.js';
import { __resetTokenCacheForTests, runWithCredentials } from '../client.js';
import { mockTokenThenResponse, TEST_CREDS } from './test-helpers.js';

describe('handleQueueTool', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    __resetTokenCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('yeastar_list_queues hits queue/list', async () => {
    mockTokenThenResponse(fetchMock, { errcode: 0, errmsg: 'SUCCESS', data: [] });
    await runWithCredentials(TEST_CREDS, () => handleQueueTool('yeastar_list_queues', {}));
    expect(new URL(fetchMock.mock.calls[1][0] as string).pathname).toBe('/openapi/v1.0/queue/list');
  });

  it('yeastar_get_queue hits queue/get with id', async () => {
    mockTokenThenResponse(fetchMock, { errcode: 0, errmsg: 'SUCCESS', data: {} });
    await runWithCredentials(TEST_CREDS, () => handleQueueTool('yeastar_get_queue', { id: '6' }));
    const url = new URL(fetchMock.mock.calls[1][0] as string);
    expect(url.pathname).toBe('/openapi/v1.0/queue/get');
    expect(url.searchParams.get('id')).toBe('6');
  });

  it('yeastar_get_queue_call_status hits queue/call_status with id', async () => {
    mockTokenThenResponse(fetchMock, { errcode: 0, errmsg: 'SUCCESS', data: {} });
    await runWithCredentials(TEST_CREDS, () => handleQueueTool('yeastar_get_queue_call_status', { id: '6' }));
    const url = new URL(fetchMock.mock.calls[1][0] as string);
    expect(url.pathname).toBe('/openapi/v1.0/queue/call_status');
    expect(url.searchParams.get('id')).toBe('6');
  });

  it('yeastar_get_queue_agent_status hits queue/agent_status with id', async () => {
    mockTokenThenResponse(fetchMock, { errcode: 0, errmsg: 'SUCCESS', data: {} });
    await runWithCredentials(TEST_CREDS, () => handleQueueTool('yeastar_get_queue_agent_status', { id: '6' }));
    const url = new URL(fetchMock.mock.calls[1][0] as string);
    expect(url.pathname).toBe('/openapi/v1.0/queue/agent_status');
    expect(url.searchParams.get('id')).toBe('6');
  });
});
