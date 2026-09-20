import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getCredentials, getExtension, listExtensions } from '../client.js';
import type { CallToolResult } from './types.js';
import { errorResult, ID_PARAM_PROPERTIES, PAGE_PARAMS_PROPERTIES, requireCredentials, SORT_PARAMS_PROPERTIES, textResult } from './shared.js';

export const EXTENSION_TOOLS: Tool[] = [
  {
    name: 'yeastar_list_extensions',
    description:
      'List extensions with basic info: number, caller ID name, email, mobile number, presence status, and per-device online status (FXS, SIP, Linkus desktop/mobile/web). For full per-extension detail (call forwarding rules, voicemail settings, permissions), use yeastar_get_extension. Does NOT include the extension\'s SIP/portal password - that field is never exposed by this connector.',
    inputSchema: { type: 'object', properties: { ...PAGE_PARAMS_PROPERTIES, ...SORT_PARAMS_PROPERTIES } },
  },
  {
    name: 'yeastar_get_extension',
    description: 'Get full detail for a single extension (call forwarding, voicemail, permissions, device bindings). Requires an extension ID from yeastar_list_extensions.',
    inputSchema: { type: 'object', properties: { ...ID_PARAM_PROPERTIES }, required: ['id'] },
  },
];

const TOOL_NAMES = new Set(EXTENSION_TOOLS.map((t) => t.name));
export function isExtensionTool(name: string): boolean {
  return TOOL_NAMES.has(name);
}

export async function handleExtensionTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;

  try {
    if (name === 'yeastar_list_extensions') {
      return textResult(
        await listExtensions(creds!, {
          page: args.page as number | undefined,
          page_size: args.page_size as number | undefined,
          sort_by: args.sort_by as string | undefined,
          order_by: args.order_by as 'asc' | 'desc' | undefined,
        })
      );
    }
    if (name === 'yeastar_get_extension') {
      return textResult(await getExtension(creds!, { id: args.id as string }));
    }
    return errorResult(`Unknown tool: ${name}`);
  } catch (err) {
    return errorResult((err as Error).message);
  }
}
