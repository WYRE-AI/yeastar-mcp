import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getCredentials, listCertificates } from '../client.js';
import type { CallToolResult } from './types.js';
import { errorResult, PAGE_PARAMS_PROPERTIES, requireCredentials, textResult } from './shared.js';

export const CERTIFICATE_TOOLS: Tool[] = [
  {
    name: 'yeastar_list_certificates',
    description:
      'List TLS certificate metadata for this appliance (name, domain, expiry date) - for monitoring certificate expiry. Does not return private key material; certificate/get is never implemented by this connector.',
    inputSchema: { type: 'object', properties: { ...PAGE_PARAMS_PROPERTIES } },
  },
];

const TOOL_NAMES = new Set(CERTIFICATE_TOOLS.map((t) => t.name));
export function isCertificateTool(name: string): boolean {
  return TOOL_NAMES.has(name);
}

export async function handleCertificateTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;

  try {
    if (name === 'yeastar_list_certificates') {
      return textResult(
        await listCertificates(creds!, { page: args.page as number | undefined, page_size: args.page_size as number | undefined })
      );
    }
    return errorResult(`Unknown tool: ${name}`);
  } catch (err) {
    return errorResult((err as Error).message);
  }
}
