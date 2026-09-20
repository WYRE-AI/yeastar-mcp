import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getSystemCapacity, getSystemInformation } from '../client.js';
import { getCredentials } from '../client.js';
import type { CallToolResult } from './types.js';
import { errorResult, requireCredentials, textResult } from './shared.js';

export const SYSTEM_TOOLS: Tool[] = [
  {
    name: 'yeastar_get_system_information',
    description: 'Get this PBX appliance\'s own identity: model, firmware version, hostname. Useful to confirm which appliance a set of credentials points at.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'yeastar_get_system_capacity',
    description: 'Get current extension/trunk/concurrent-call usage against this appliance\'s licensed capacity limits.',
    inputSchema: { type: 'object', properties: {} },
  },
];

const TOOL_NAMES = new Set(SYSTEM_TOOLS.map((t) => t.name));
export function isSystemTool(name: string): boolean {
  return TOOL_NAMES.has(name);
}

export async function handleSystemTool(name: string, _args: Record<string, unknown>): Promise<CallToolResult> {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;

  try {
    if (name === 'yeastar_get_system_information') {
      return textResult(await getSystemInformation(creds!));
    }
    if (name === 'yeastar_get_system_capacity') {
      return textResult(await getSystemCapacity(creds!));
    }
    return errorResult(`Unknown tool: ${name}`);
  } catch (err) {
    return errorResult((err as Error).message);
  }
}
