/**
 * Yeastar P-Series PBX authenticates with a per-appliance OAuth-style
 * client_id/client_secret pair, generated in the PBX's own web portal
 * (Integrations -> API). There is no shared hosted endpoint - each
 * customer's PBX is its own appliance with its own domain/IP, so a
 * `pbxDomain` field travels alongside the credential pair (same shape as
 * every other self-hosted/BYO-instance connector in this fleet, e.g.
 * itglue-mcp's baseUrl or hudu-mcp's baseUrl - not a single hosted
 * multi-tenant API like Cork or UniFi).
 *
 * This connector never proxies client_id/client_secret directly to a PBX
 * request. It exchanges them for a short-lived access_token itself (POST
 * /openapi/v1.0/get_token) and caches that token in memory, keyed by
 * appliance+client, until it's within a minute of expiring. See
 * client.ts's getAccessToken() for why: access tokens live only 30 minutes
 * and Yeastar caps each application to 8 simultaneous valid tokens, so
 * minting a fresh token on every tool call would both add a needless round
 * trip and risk exhausting that cap under concurrent use.
 */
export interface YeastarCredentials {
  /** This appliance's own domain/IP and port, e.g. "https://pbx.example.com:8088". A bare host (no scheme) is treated as https. */
  pbxDomain: string;
  /** OAuth-style Client ID from the PBX web portal (Integrations -> API). Not secret by itself, but treated as one - see README. */
  clientId: string;
  /** OAuth-style Client Secret from the PBX web portal. Secret. */
  clientSecret: string;
}

/** Yeastar's standard response envelope: HTTP 200 with an errcode field carrying the real result. errcode 0 = success. */
export interface YeastarEnvelope<T = unknown> {
  errcode: number;
  errmsg: string;
  total_number?: number;
  data?: T;
  [key: string]: unknown;
}

/**
 * Thrown when Yeastar's own errcode indicates an authentication problem
 * that a single token refresh-and-retry won't fix (bad client_id/secret,
 * ACCESS DENIED). Distinct from a transient TOKEN EXPIRED (errcode 10004),
 * which client.ts retries once internally rather than surfacing.
 */
export class YeastarAuthError extends Error {}

/** Thrown for any other non-zero errcode, or a non-2xx HTTP response. */
export class YeastarApiError extends Error {
  constructor(message: string, readonly httpStatus?: number, readonly errcode?: number) {
    super(message);
  }
}

/** Yeastar's documented errcode values relevant to this connector (help.yeastar.com, "Error Code and Error Message"). */
export const YEASTAR_ERRCODE = {
  SUCCESS: 0,
  PARTIAL_SUCCESS: 1,
  TOKEN_EXPIRED: 10004,
  ACCESS_DENIED: 10005,
  DATA_NOT_FOUND: 60001,
} as const;

export interface PageParams {
  page?: number;
  page_size?: number;
}

export interface SortParams {
  sort_by?: string;
  order_by?: 'asc' | 'desc';
}

export interface IdParam {
  id: string;
}
