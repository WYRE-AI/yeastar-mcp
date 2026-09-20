import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getCredentials, listCompanyContacts } from '../client.js';
import type { CallToolResult } from './types.js';
import { errorResult, PAGE_PARAMS_PROPERTIES, requireCredentials, textResult } from './shared.js';

export const DIRECTORY_TOOLS: Tool[] = [
  {
    name: 'yeastar_list_company_contacts',
    description: 'List the company-wide contact directory (shared contacts visible to all extensions - distinct from any individual extension\'s personal phonebook, which this connector does not expose).',
    inputSchema: { type: 'object', properties: { ...PAGE_PARAMS_PROPERTIES } },
  },
];

const TOOL_NAMES = new Set(DIRECTORY_TOOLS.map((t) => t.name));
export function isDirectoryTool(name: string): boolean {
  return TOOL_NAMES.has(name);
}

export async function handleDirectoryTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;

  try {
    if (name === 'yeastar_list_company_contacts') {
      return textResult(
        await listCompanyContacts(creds!, { page: args.page as number | undefined, page_size: args.page_size as number | undefined })
      );
    }
    return errorResult(`Unknown tool: ${name}`);
  } catch (err) {
    return errorResult((err as Error).message);
  }
}
