import type { YeastarCredentials } from '../types.js';
import type { CallToolResult } from './types.js';

export function textResult(value: unknown): CallToolResult {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return { content: [{ type: 'text', text }] };
}

export function errorResult(message: string): CallToolResult {
  return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
}

/** Returns an error CallToolResult if credentials are missing, else null. */
export function requireCredentials(creds: YeastarCredentials | null): CallToolResult | null {
  if (!creds) {
    return errorResult(
      'No Yeastar credentials configured. Set YEASTAR_PBX_DOMAIN, YEASTAR_CLIENT_ID, and YEASTAR_CLIENT_SECRET.'
    );
  }
  return null;
}

/** Shared input-schema fragment for the page-paginated list endpoints (every Yeastar /list endpoint). */
export const PAGE_PARAMS_PROPERTIES = {
  page: { type: 'number', description: 'Page number (1-based). Defaults to 1.' },
  page_size: { type: 'number', description: 'Items per page. Defaults to the PBX\'s own default page size.' },
} as const;

/** Shared input-schema fragment for the sort_by/order_by params some /list endpoints accept. */
export const SORT_PARAMS_PROPERTIES = {
  sort_by: { type: 'string', description: 'Field to sort by (field names vary by endpoint - see the PBX field list in the response).' },
  order_by: { type: 'string', enum: ['asc', 'desc'], description: 'Sort direction.' },
} as const;

/** Shared input-schema fragment for the single required `id` param every /get endpoint takes. */
export const ID_PARAM_PROPERTIES = {
  id: { type: 'string', description: 'Object ID, from the corresponding list tool.' },
} as const;
