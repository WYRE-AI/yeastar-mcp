import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getCredentials, listCallReports } from '../client.js';
import type { CallToolResult } from './types.js';
import { errorResult, PAGE_PARAMS_PROPERTIES, requireCredentials, textResult } from './shared.js';

export const CALL_REPORT_TOOLS: Tool[] = [
  {
    name: 'yeastar_list_call_reports',
    description: 'List aggregated call reports (summary call statistics), optionally bound by start_time/end_time. Distinct from yeastar_list_cdr, which returns individual call records rather than aggregates.',
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

const TOOL_NAMES = new Set(CALL_REPORT_TOOLS.map((t) => t.name));
export function isCallReportTool(name: string): boolean {
  return TOOL_NAMES.has(name);
}

export async function handleCallReportTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;

  try {
    if (name === 'yeastar_list_call_reports') {
      return textResult(
        await listCallReports(creds!, {
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
