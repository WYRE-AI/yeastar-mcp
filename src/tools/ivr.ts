import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getCredentials, getIvr, listIvrs } from '../client.js';
import type { CallToolResult } from './types.js';
import { errorResult, ID_PARAM_PROPERTIES, PAGE_PARAMS_PROPERTIES, requireCredentials, textResult } from './shared.js';

export const IVR_TOOLS: Tool[] = [
  {
    name: 'yeastar_list_ivrs',
    description: 'List IVR (auto-attendant) menus.',
    inputSchema: { type: 'object', properties: { ...PAGE_PARAMS_PROPERTIES } },
  },
  {
    name: 'yeastar_get_ivr',
    description: 'Get full detail (key press mapping, prompts, timeout destination) for a single IVR. Requires an ID from yeastar_list_ivrs.',
    inputSchema: { type: 'object', properties: { ...ID_PARAM_PROPERTIES }, required: ['id'] },
  },
];

const TOOL_NAMES = new Set(IVR_TOOLS.map((t) => t.name));
export function isIvrTool(name: string): boolean {
  return TOOL_NAMES.has(name);
}

export async function handleIvrTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;

  try {
    if (name === 'yeastar_list_ivrs') {
      return textResult(
        await listIvrs(creds!, { page: args.page as number | undefined, page_size: args.page_size as number | undefined })
      );
    }
    if (name === 'yeastar_get_ivr') {
      return textResult(await getIvr(creds!, { id: args.id as string }));
    }
    return errorResult(`Unknown tool: ${name}`);
  } catch (err) {
    return errorResult((err as Error).message);
  }
}
