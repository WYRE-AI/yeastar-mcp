import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getCredentials, listBackups } from '../client.js';
import type { CallToolResult } from './types.js';
import { errorResult, PAGE_PARAMS_PROPERTIES, requireCredentials, textResult } from './shared.js';

export const BACKUP_TOOLS: Tool[] = [
  {
    name: 'yeastar_list_backups',
    description:
      'List configuration backup metadata for this appliance (name, created time, size) - for monitoring backup health (e.g. "when did the last backup run"). Does not return the backup file contents; backup/download is never implemented by this connector, since a backup file can embed configuration secrets.',
    inputSchema: { type: 'object', properties: { ...PAGE_PARAMS_PROPERTIES } },
  },
];

const TOOL_NAMES = new Set(BACKUP_TOOLS.map((t) => t.name));
export function isBackupTool(name: string): boolean {
  return TOOL_NAMES.has(name);
}

export async function handleBackupTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;

  try {
    if (name === 'yeastar_list_backups') {
      return textResult(
        await listBackups(creds!, { page: args.page as number | undefined, page_size: args.page_size as number | undefined })
      );
    }
    return errorResult(`Unknown tool: ${name}`);
  } catch (err) {
    return errorResult((err as Error).message);
  }
}
