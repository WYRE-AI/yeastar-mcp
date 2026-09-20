import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getCredentials, listCdr } from '../client.js';
import type { CallToolResult } from './types.js';
import { errorResult, PAGE_PARAMS_PROPERTIES, requireCredentials, textResult } from './shared.js';

export const CDR_TOOLS: Tool[] = [
  {
    name: 'yeastar_list_cdr',
    description:
      'List call detail records (CDR): who called whom, when, duration, disposition. Optionally bound by start_time/end_time. Uses the openapi/v1.0 CDR surface - this connector does not target the separate v2.0 CDR API. Does not include recording audio (recording endpoints are not implemented by this connector).',
    inputSchema: {
      type: 'object',
      properties: {
        start_time: { type: 'string', description: 'Inclusive lower bound, format YYYY-MM-DD HH:MM:SS.' },
        end_time: { type: 'string', description: 'Inclusive upper bound, format YYYY-MM-DD HH:MM:SS.' },
        ...PAGE_PARAMS_PROPERTIES,
      },
    },
  },
];

const TOOL_NAMES = new Set(CDR_TOOLS.map((t) => t.name));
export function isCdrTool(name: string): boolean {
  return TOOL_NAMES.has(name);
}

export async function handleCdrTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;

  try {
    if (name === 'yeastar_list_cdr') {
      return textResult(
        await listCdr(creds!, {
          start_time: args.start_time as string | undefined,
          end_time: args.end_time as string | undefined,
          page: args.page as number | undefined,
          page_size: args.page_size as number | undefined,
        })
      );
    }
    return errorResult(`Unknown tool: ${name}`);
  } catch (err) {
    return errorResult((err as Error).message);
  }
}
