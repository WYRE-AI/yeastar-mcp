import type { Mock } from 'vitest';
import type { CallToolResult } from '../tools/types.js';

/** Extracts the text of the first content block, failing loudly if it isn't text. */
export function textOf(result: CallToolResult): string {
  const block = result.content?.[0];
  if (!block || block.type !== 'text') {
    throw new Error(`Expected a text content block, got: ${JSON.stringify(block)}`);
  }
  return block.text;
}

/** Builds a Response whose body is JSON, matching Yeastar's response shape. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export const TEST_CREDS = {
  pbxDomain: 'https://pbx.example.com:8088',
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
};

const TOKEN_RESPONSE_BODY = {
  errcode: 0,
  errmsg: 'SUCCESS',
  access_token: 'test-access-token',
  access_token_expire_time: 1800,
  refresh_token: 'test-refresh-token',
  refresh_token_expire_time: 86400,
};

/**
 * Queues the two fetch calls every tool call makes end-to-end: the
 * get_token exchange, then the actual GET. Every handler test uses this so
 * it doesn't need to know client.ts's internal token-caching mechanics.
 */
export function mockTokenThenResponse(fetchMock: Mock, body: unknown, status = 200): void {
  fetchMock.mockResolvedValueOnce(jsonResponse(TOKEN_RESPONSE_BODY));
  fetchMock.mockResolvedValueOnce(jsonResponse(body, status));
}
