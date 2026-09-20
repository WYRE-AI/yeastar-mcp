import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getCredentials, getQueue, getQueueAgentStatus, getQueueCallStatus, listQueues } from '../client.js';
import type { CallToolResult } from './types.js';
import { errorResult, ID_PARAM_PROPERTIES, PAGE_PARAMS_PROPERTIES, requireCredentials, textResult } from './shared.js';

export const QUEUE_TOOLS: Tool[] = [
  {
    name: 'yeastar_list_queues',
    description: 'List call queues.',
    inputSchema: { type: 'object', properties: { ...PAGE_PARAMS_PROPERTIES } },
  },
  {
    name: 'yeastar_get_queue',
    description: 'Get full configuration (strategy, timeout, member agents) for a single queue. Requires an ID from yeastar_list_queues.',
    inputSchema: { type: 'object', properties: { ...ID_PARAM_PROPERTIES }, required: ['id'] },
  },
  {
    name: 'yeastar_get_queue_call_status',
    description: 'Get the current live call state of a queue: calls waiting, calls in progress, wait times. A read of current state - does not join, transfer, or otherwise touch any call. Requires an ID from yeastar_list_queues.',
    inputSchema: { type: 'object', properties: { ...ID_PARAM_PROPERTIES }, required: ['id'] },
  },
  {
    name: 'yeastar_get_queue_agent_status',
    description: 'Get the current login/pause/busy state of each agent in a queue. A read of current state - does not log an agent in, out, or change their pause state. Requires an ID from yeastar_list_queues.',
    inputSchema: { type: 'object', properties: { ...ID_PARAM_PROPERTIES }, required: ['id'] },
  },
];

const TOOL_NAMES = new Set(QUEUE_TOOLS.map((t) => t.name));
export function isQueueTool(name: string): boolean {
  return TOOL_NAMES.has(name);
}

export async function handleQueueTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;

  try {
    if (name === 'yeastar_list_queues') {
      return textResult(
        await listQueues(creds!, { page: args.page as number | undefined, page_size: args.page_size as number | undefined })
      );
    }
    if (name === 'yeastar_get_queue') {
      return textResult(await getQueue(creds!, { id: args.id as string }));
    }
    if (name === 'yeastar_get_queue_call_status') {
      return textResult(await getQueueCallStatus(creds!, { id: args.id as string }));
    }
    if (name === 'yeastar_get_queue_agent_status') {
      return textResult(await getQueueAgentStatus(creds!, { id: args.id as string }));
    }
    return errorResult(`Unknown tool: ${name}`);
  } catch (err) {
    return errorResult((err as Error).message);
  }
}
