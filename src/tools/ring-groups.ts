import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getCredentials, getRingGroup, listRingGroups } from '../client.js';
import type { CallToolResult } from './types.js';
import { errorResult, ID_PARAM_PROPERTIES, PAGE_PARAMS_PROPERTIES, requireCredentials, textResult } from './shared.js';

export const RING_GROUP_TOOLS: Tool[] = [
  {
    name: 'yeastar_list_ring_groups',
    description: 'List ring groups (a set of extensions that ring together on an incoming call).',
    inputSchema: { type: 'object', properties: { ...PAGE_PARAMS_PROPERTIES } },
  },
  {
    name: 'yeastar_get_ring_group',
    description: 'Get full detail (member extensions, ring strategy, timeout destination) for a single ring group. Requires an ID from yeastar_list_ring_groups.',
    inputSchema: { type: 'object', properties: { ...ID_PARAM_PROPERTIES }, required: ['id'] },
  },
];

const TOOL_NAMES = new Set(RING_GROUP_TOOLS.map((t) => t.name));
export function isRingGroupTool(name: string): boolean {
  return TOOL_NAMES.has(name);
}

export async function handleRingGroupTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;

  try {
    if (name === 'yeastar_list_ring_groups') {
      return textResult(
        await listRingGroups(creds!, { page: args.page as number | undefined, page_size: args.page_size as number | undefined })
      );
    }
    if (name === 'yeastar_get_ring_group') {
      return textResult(await getRingGroup(creds!, { id: args.id as string }));
    }
    return errorResult(`Unknown tool: ${name}`);
  } catch (err) {
    return errorResult((err as Error).message);
  }
}
