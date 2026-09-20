import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getCredentials, getTrunk, listItspTrunks, listTrunks } from '../client.js';
import type { CallToolResult } from './types.js';
import { errorResult, ID_PARAM_PROPERTIES, PAGE_PARAMS_PROPERTIES, requireCredentials, textResult } from './shared.js';

export const TRUNK_TOOLS: Tool[] = [
  {
    name: 'yeastar_list_trunks',
    description: 'List trunks (VoIP/ITSP/FXO) configured on this appliance.',
    inputSchema: { type: 'object', properties: { ...PAGE_PARAMS_PROPERTIES } },
  },
  {
    name: 'yeastar_get_trunk',
    description:
      'Get full detail for a single trunk. Requires an ID from yeastar_list_trunks. Any field that looks like a SIP registration secret or password is stripped from the response before it reaches you - this connector never returns trunk auth credentials.',
    inputSchema: { type: 'object', properties: { ...ID_PARAM_PROPERTIES }, required: ['id'] },
  },
  {
    name: 'yeastar_list_itsp_trunks',
    description: 'List ITSP (VoIP provider) templates available on this appliance for trunk creation - not this appliance\'s own configured trunks (use yeastar_list_trunks for those).',
    inputSchema: { type: 'object', properties: { ...PAGE_PARAMS_PROPERTIES } },
  },
];

const TOOL_NAMES = new Set(TRUNK_TOOLS.map((t) => t.name));
export function isTrunkTool(name: string): boolean {
  return TOOL_NAMES.has(name);
}

export async function handleTrunkTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;

  try {
    if (name === 'yeastar_list_trunks') {
      return textResult(
        await listTrunks(creds!, { page: args.page as number | undefined, page_size: args.page_size as number | undefined })
      );
    }
    if (name === 'yeastar_get_trunk') {
      return textResult(await getTrunk(creds!, { id: args.id as string }));
    }
    if (name === 'yeastar_list_itsp_trunks') {
      return textResult(
        await listItspTrunks(creds!, { page: args.page as number | undefined, page_size: args.page_size as number | undefined })
      );
    }
    return errorResult(`Unknown tool: ${name}`);
  } catch (err) {
    return errorResult((err as Error).message);
  }
}
