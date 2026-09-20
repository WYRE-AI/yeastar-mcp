import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getCredentials, getExtensionGroup, listExtensionGroups } from '../client.js';
import type { CallToolResult } from './types.js';
import { errorResult, ID_PARAM_PROPERTIES, PAGE_PARAMS_PROPERTIES, requireCredentials, textResult } from './shared.js';

export const EXTENSION_GROUP_TOOLS: Tool[] = [
  {
    name: 'yeastar_list_extension_groups',
    description: 'List extension groups.',
    inputSchema: { type: 'object', properties: { ...PAGE_PARAMS_PROPERTIES } },
  },
  {
    name: 'yeastar_get_extension_group',
    description: 'Get full detail (member extensions) for a single extension group. Requires an ID from yeastar_list_extension_groups.',
    inputSchema: { type: 'object', properties: { ...ID_PARAM_PROPERTIES }, required: ['id'] },
  },
];

const TOOL_NAMES = new Set(EXTENSION_GROUP_TOOLS.map((t) => t.name));
export function isExtensionGroupTool(name: string): boolean {
  return TOOL_NAMES.has(name);
}

export async function handleExtensionGroupTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;

  try {
    if (name === 'yeastar_list_extension_groups') {
      return textResult(
        await listExtensionGroups(creds!, {
          page: args.page as number | undefined,
          page_size: args.page_size as number | undefined,
        })
      );
    }
    if (name === 'yeastar_get_extension_group') {
      return textResult(await getExtensionGroup(creds!, { id: args.id as string }));
    }
    return errorResult(`Unknown tool: ${name}`);
  } catch (err) {
    return errorResult((err as Error).message);
  }
}
