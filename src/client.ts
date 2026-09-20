import { AsyncLocalStorage } from 'node:async_hooks';
import { logger } from './utils/logger.js';
import { YEASTAR_ERRCODE, YeastarApiError, YeastarAuthError } from './types.js';
import type {
  IdParam,
  PageParams,
  SortParams,
  YeastarCredentials,
  YeastarEnvelope,
} from './types.js';

const API_PATH = '/openapi/v1.0';
const USER_AGENT = 'OpenAPI';
// access tokens live 30 minutes (help.yeastar.com, "Authorization Rule"); refresh
// this many ms before actual expiry so a request never races a token that's
// about to die mid-flight.
const TOKEN_REFRESH_MARGIN_MS = 60_000;

// Request-scoped credential store. In gateway mode the HTTP layer runs each
// request inside runWithCredentials({pbxDomain,clientId,clientSecret});
// getCredentials() reads from it. Falls back to process.env for
// stdio/single-tenant mode.
const credStore = new AsyncLocalStorage<YeastarCredentials>();

export function runWithCredentials<T>(creds: YeastarCredentials, fn: () => T): T {
  return credStore.run(creds, fn);
}

export function getCredentials(): YeastarCredentials | null {
  const scoped = credStore.getStore();
  if (scoped?.pbxDomain && scoped?.clientId && scoped?.clientSecret) return scoped;
  const pbxDomain = process.env.YEASTAR_PBX_DOMAIN;
  const clientId = process.env.YEASTAR_CLIENT_ID;
  const clientSecret = process.env.YEASTAR_CLIENT_SECRET;
  if (!pbxDomain || !clientId || !clientSecret) {
    logger.warn('Missing credentials', {
      hasPbxDomain: !!pbxDomain,
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
    });
    return null;
  }
  return { pbxDomain, clientId, clientSecret };
}

/** A bare host (no scheme) is treated as https; a trailing slash is stripped. */
function normalizeBaseUrl(pbxDomain: string): string {
  const withScheme = /^https?:\/\//i.test(pbxDomain) ? pbxDomain : `https://${pbxDomain}`;
  return withScheme.replace(/\/+$/, '');
}

// ---------------------------------------------------------------------
// Access-token cache. Yeastar access tokens live 30 minutes and each
// application is capped at 8 simultaneous valid tokens (help.yeastar.com,
// "Get Access Token") - minting a fresh token on every tool call would add
// a needless round trip per call AND risk exhausting that cap the moment
// more than 8 tool calls for the same credentials are in flight within a
// 30-minute window (a single agent session routinely exceeds that).
// Caching in memory, keyed by appliance+client, means one token serves
// every tool call for a given customer until it's about to expire.
//
// This is process-wide, not per-request, which is intentional: the sidecar
// serves one credential set per connected customer for the life of the
// container, so sharing the cache across concurrent requests for the same
// customer is correct, not a cross-tenant leak (the cache key includes the
// full credential triple, so two different customers never collide).
// ---------------------------------------------------------------------
interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

const tokenCache = new Map<string, CachedToken>();

function tokenCacheKey(creds: YeastarCredentials): string {
  return `${normalizeBaseUrl(creds.pbxDomain)}::${creds.clientId}::${creds.clientSecret}`;
}

interface GetTokenResponse extends YeastarEnvelope {
  access_token?: string;
  access_token_expire_time?: number;
  refresh_token?: string;
  refresh_token_expire_time?: number;
}

async function mintAccessToken(creds: YeastarCredentials): Promise<string> {
  const url = `${normalizeBaseUrl(creds.pbxDomain)}${API_PATH}/get_token`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/json', Accept: 'application/json' },
    // Yeastar's own field names for this endpoint are "username"/"password" -
    // the docs are explicit that these ARE the Client ID / Client Secret
    // ("obtain the username from the Client ID on PBX web portal"), not a
    // separate credential. Preserved verbatim rather than renamed, so this
    // matches the vendor's actual wire format.
    body: JSON.stringify({ username: creds.clientId, password: creds.clientSecret }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new YeastarApiError(`Yeastar get_token failed: HTTP ${res.status}`, res.status);
  }
  const json = (await res.json()) as GetTokenResponse;
  if (json.errcode !== YEASTAR_ERRCODE.SUCCESS || !json.access_token || !json.access_token_expire_time) {
    throw new YeastarAuthError(
      `Yeastar rejected the client credentials (errcode ${json.errcode}): ${json.errmsg || 'unknown error'}`
    );
  }

  const key = tokenCacheKey(creds);
  const expiresAt = Date.now() + json.access_token_expire_time * 1000;
  tokenCache.set(key, { accessToken: json.access_token, expiresAt });
  return json.access_token;
}

async function getAccessToken(creds: YeastarCredentials, forceRefresh = false): Promise<string> {
  const key = tokenCacheKey(creds);
  if (!forceRefresh) {
    const cached = tokenCache.get(key);
    if (cached && cached.expiresAt - Date.now() > TOKEN_REFRESH_MARGIN_MS) {
      return cached.accessToken;
    }
  }
  return mintAccessToken(creds);
}

function buildQuery(params: Record<string, unknown> = {}): URLSearchParams {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    qs.append(key, String(value));
  }
  return qs;
}

// ---------------------------------------------------------------------
// Defensive field-stripping. This connector is GET-only by construction
// (see doGet below - there is no doPost/doPut/doDelete anywhere in this
// codebase), but several PBX object types (trunks especially) commonly
// carry SIP registration secrets inline in their own config payload, and
// Yeastar's schema for these objects isn't fully machine-verifiable from
// the docs alone. Rather than special-case one endpoint, every response
// from every tool in this connector passes through this stripper before it
// ever reaches the model: any object key matching /secret|password|pwd/i,
// at any depth, is dropped. This is a blanket safety net on top of, not
// instead of, the endpoint-level exclusions in README (extension/getpassword,
// conference/viewpassword are never called at all).
// ---------------------------------------------------------------------
const SECRET_FIELD_RE = /(secret|password|pwd)/i;

export function stripSecretFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripSecretFields(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_FIELD_RE.test(key)) continue;
      out[key] = stripSecretFields(v);
    }
    return out as T;
  }
  return value;
}

async function doGet<T>(
  creds: YeastarCredentials,
  path: string,
  query: Record<string, unknown> = {},
  isRetry = false
): Promise<T> {
  const accessToken = await getAccessToken(creds, isRetry);
  const qs = buildQuery({ ...query, access_token: accessToken }).toString();
  const url = `${normalizeBaseUrl(creds.pbxDomain)}${API_PATH}${path}?${qs}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });

  // 429 is a distinct failure mode from an auth/parameter error - grouping
  // it in would hide a transient rate limit behind a message that reads
  // like a bad request. Yeastar's own docs don't enumerate a rate-limit
  // errcode (see README), so this is the one guard available: the HTTP
  // status itself.
  if (res.status === 429) {
    throw new YeastarApiError(`Yeastar rate-limited the request (HTTP 429): ${path}`, 429);
  }
  if (!res.ok) {
    throw new YeastarApiError(`Yeastar ${path} failed: HTTP ${res.status}`, res.status);
  }

  const json = (await res.json()) as YeastarEnvelope<T>;

  // errcode 10004 (TOKEN EXPIRED) is a normal, expected event under this
  // connector's cache (the cache is a freshness *optimization*, not a
  // guarantee - the PBX's own clock is authoritative) - retried exactly
  // once with a forced fresh token, transparent to the caller. A second
  // failure is a real problem, not surfaced as a silent loop.
  if (json.errcode === YEASTAR_ERRCODE.TOKEN_EXPIRED && !isRetry) {
    return doGet<T>(creds, path, query, true);
  }
  if (json.errcode === YEASTAR_ERRCODE.ACCESS_DENIED) {
    throw new YeastarAuthError(`Yeastar denied access (errcode 10005) to ${path}: ${json.errmsg}`);
  }
  if (json.errcode !== YEASTAR_ERRCODE.SUCCESS && json.errcode !== YEASTAR_ERRCODE.PARTIAL_SUCCESS) {
    throw new YeastarApiError(
      `Yeastar ${path} failed (errcode ${json.errcode}): ${json.errmsg || 'unknown error'}`,
      res.status,
      json.errcode
    );
  }

  return stripSecretFields(json as unknown as T);
}

// ---------------------------------------------------------------------
// System
// ---------------------------------------------------------------------

/** GET system/information - model, firmware version, hostname. */
export async function getSystemInformation(creds: YeastarCredentials): Promise<YeastarEnvelope> {
  return doGet(creds, '/system/information');
}

/** GET system/capacity - extension/trunk capacity usage against this appliance's licensed limits. */
export async function getSystemCapacity(creds: YeastarCredentials): Promise<YeastarEnvelope> {
  return doGet(creds, '/system/capacity');
}

// ---------------------------------------------------------------------
// Extensions - extension/getpassword is never implemented; see README.
// ---------------------------------------------------------------------

export interface ListExtensionsParams extends PageParams, SortParams {}

/** GET extension/list - basic info (number, name, presence/online status) for every extension. */
export async function listExtensions(
  creds: YeastarCredentials,
  params: ListExtensionsParams = {}
): Promise<YeastarEnvelope> {
  return doGet(creds, '/extension/list', { ...params });
}

/** GET extension/get - full detail for a single extension. */
export async function getExtension(creds: YeastarCredentials, { id }: IdParam): Promise<YeastarEnvelope> {
  return doGet(creds, '/extension/get', { id });
}

// ---------------------------------------------------------------------
// Extension Groups
// ---------------------------------------------------------------------

/** GET extension_group/list - all extension groups. */
export async function listExtensionGroups(
  creds: YeastarCredentials,
  params: PageParams = {}
): Promise<YeastarEnvelope> {
  return doGet(creds, '/extension_group/list', { ...params });
}

/** GET extension_group/get - full detail (member extensions) for a single extension group. */
export async function getExtensionGroup(creds: YeastarCredentials, { id }: IdParam): Promise<YeastarEnvelope> {
  return doGet(creds, '/extension_group/get', { id });
}

// ---------------------------------------------------------------------
// Trunks - responses pass through stripSecretFields() (see doGet) since
// trunk config commonly carries SIP registration secrets inline.
// ---------------------------------------------------------------------

/** GET trunk/list - all trunks (VoIP/ITSP/FXO). */
export async function listTrunks(creds: YeastarCredentials, params: PageParams = {}): Promise<YeastarEnvelope> {
  return doGet(creds, '/trunk/list', { ...params });
}

/** GET trunk/get - full detail for a single trunk. Secret-shaped fields (auth password, register password) are stripped. */
export async function getTrunk(creds: YeastarCredentials, { id }: IdParam): Promise<YeastarEnvelope> {
  return doGet(creds, '/trunk/get', { id });
}

/** GET trunk/itsp_list - ITSP (VoIP provider) templates available for trunk creation on this appliance. */
export async function listItspTrunks(creds: YeastarCredentials, params: PageParams = {}): Promise<YeastarEnvelope> {
  return doGet(creds, '/trunk/itsp_list', { ...params });
}

// ---------------------------------------------------------------------
// Inbound / Outbound Routes
// ---------------------------------------------------------------------

export async function listInboundRoutes(creds: YeastarCredentials, params: PageParams = {}): Promise<YeastarEnvelope> {
  return doGet(creds, '/inbound_route/list', { ...params });
}

export async function getInboundRoute(creds: YeastarCredentials, { id }: IdParam): Promise<YeastarEnvelope> {
  return doGet(creds, '/inbound_route/get', { id });
}

export async function listOutboundRoutes(creds: YeastarCredentials, params: PageParams = {}): Promise<YeastarEnvelope> {
  return doGet(creds, '/outbound_route/list', { ...params });
}

export async function getOutboundRoute(creds: YeastarCredentials, { id }: IdParam): Promise<YeastarEnvelope> {
  return doGet(creds, '/outbound_route/get', { id });
}

// ---------------------------------------------------------------------
// IVR
// ---------------------------------------------------------------------

export async function listIvrs(creds: YeastarCredentials, params: PageParams = {}): Promise<YeastarEnvelope> {
  return doGet(creds, '/ivr/list', { ...params });
}

export async function getIvr(creds: YeastarCredentials, { id }: IdParam): Promise<YeastarEnvelope> {
  return doGet(creds, '/ivr/get', { id });
}

// ---------------------------------------------------------------------
// Ring Groups
// ---------------------------------------------------------------------

export async function listRingGroups(creds: YeastarCredentials, params: PageParams = {}): Promise<YeastarEnvelope> {
  return doGet(creds, '/ringgroup/list', { ...params });
}

export async function getRingGroup(creds: YeastarCredentials, { id }: IdParam): Promise<YeastarEnvelope> {
  return doGet(creds, '/ringgroup/get', { id });
}

// ---------------------------------------------------------------------
// Queues - agent_login/agent_pause are control actions (despite GET verb in
// Yeastar's own docs) and are never implemented; see README.
// ---------------------------------------------------------------------

export async function listQueues(creds: YeastarCredentials, params: PageParams = {}): Promise<YeastarEnvelope> {
  return doGet(creds, '/queue/list', { ...params });
}

export async function getQueue(creds: YeastarCredentials, { id }: IdParam): Promise<YeastarEnvelope> {
  return doGet(creds, '/queue/get', { id });
}

/** GET queue/call_status - current calls waiting/in-progress for a queue. Live read, not a control action. */
export async function getQueueCallStatus(creds: YeastarCredentials, { id }: IdParam): Promise<YeastarEnvelope> {
  return doGet(creds, '/queue/call_status', { id });
}

/** GET queue/agent_status - current login/pause state of each agent in a queue. Live read, not a control action. */
export async function getQueueAgentStatus(creds: YeastarCredentials, { id }: IdParam): Promise<YeastarEnvelope> {
  return doGet(creds, '/queue/agent_status', { id });
}

// ---------------------------------------------------------------------
// Company Contacts
// ---------------------------------------------------------------------

export async function listCompanyContacts(creds: YeastarCredentials, params: PageParams = {}): Promise<YeastarEnvelope> {
  return doGet(creds, '/company_contact/list', { ...params });
}

// ---------------------------------------------------------------------
// CDR (Call Detail Records) - openapi/v1.0 only; this connector doesn't
// target the v2.0 CDR surface (see README).
// ---------------------------------------------------------------------

export interface ListCdrParams extends PageParams {
  start_time?: string;
  end_time?: string;
}

export async function listCdr(creds: YeastarCredentials, params: ListCdrParams = {}): Promise<YeastarEnvelope> {
  return doGet(creds, '/cdr/list', { ...params });
}

// ---------------------------------------------------------------------
// Call Reports
// ---------------------------------------------------------------------

export interface ListCallReportsParams extends PageParams {
  start_time?: string;
  end_time?: string;
}

export async function listCallReports(creds: YeastarCredentials, params: ListCallReportsParams = {}): Promise<YeastarEnvelope> {
  return doGet(creds, '/call_report/list', { ...params });
}

// ---------------------------------------------------------------------
// Backups - metadata only. backup/download (the actual backup file, which
// can embed configuration secrets) is never implemented; see README.
// ---------------------------------------------------------------------

export async function listBackups(creds: YeastarCredentials, params: PageParams = {}): Promise<YeastarEnvelope> {
  return doGet(creds, '/backup/list', { ...params });
}

// ---------------------------------------------------------------------
// Certificates - metadata only (name/domain/expiry), useful for expiry
// monitoring. certificate/get is not implemented - see README.
// ---------------------------------------------------------------------

export async function listCertificates(creds: YeastarCredentials, params: PageParams = {}): Promise<YeastarEnvelope> {
  return doGet(creds, '/certificate/list', { ...params });
}

/**
 * Test-only: clears the in-memory access-token cache so each test starts
 * from a clean slate rather than reusing a token minted by a previous test
 * in the same process. No runtime code path calls this.
 */
export function __resetTokenCacheForTests(): void {
  tokenCache.clear();
}
