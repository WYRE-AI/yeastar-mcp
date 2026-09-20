import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getCredentials, getInboundRoute, getOutboundRoute, listInboundRoutes, listOutboundRoutes } from '../client.js';
import type { CallToolResult } from './types.js';
import { errorResult, ID_PARAM_PROPERTIES, PAGE_PARAMS_PROPERTIES, requireCredentials, textResult } from './shared.js';

export const ROUTE_TOOLS: Tool[] = [
  {
    name: 'yeastar_list_inbound_routes',
    description: 'List inbound call routes (which DID/pattern sends calls to which destination - extension, ring group, IVR, queue, etc).',
    inputSchema: { type: 'object', properties: { ...PAGE_PARAMS_PROPERTIES } },
  },
  {
    name: 'yeastar_get_inbound_route',
    description: 'Get full detail for a single inbound route. Requires an ID from yeastar_list_inbound_routes.',
    inputSchema: { type: 'object', properties: { ...ID_PARAM_PROPERTIES }, required: ['id'] },
  },
  {
    name: 'yeastar_list_outbound_routes',
    description: 'List outbound call routes (which trunk handles calls matching which dial pattern).',
    inputSchema: { type: 'object', properties: { ...PAGE_PARAMS_PROPERTIES } },
  },
  {
    name: 'yeastar_get_outbound_route',
    description: 'Get full detail for a single outbound route. Requires an ID from yeastar_list_outbound_routes.',
    inputSchema: { type: 'object', properties: { ...ID_PARAM_PROPERTIES }, required: ['id'] },
  },
];

const TOOL_NAMES = new Set(ROUTE_TOOLS.map((t) => t.name));
export function isRouteTool(name: string): boolean {
  return TOOL_NAMES.has(name);
}

export async function handleRouteTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  const creds = getCredentials();
  const missing = requireCredentials(creds);
  if (missing) return missing;

  try {
    if (name === 'yeastar_list_inbound_routes') {
      return textResult(
        await listInboundRoutes(creds!, { page: args.page as number | undefined, page_size: args.page_size as number | undefined })
      );
    }
    if (name === 'yeastar_get_inbound_route') {
      return textResult(await getInboundRoute(creds!, { id: args.id as string }));
    }
    if (name === 'yeastar_list_outbound_routes') {
      return textResult(
        await listOutboundRoutes(creds!, { page: args.page as number | undefined, page_size: args.page_size as number | undefined })
      );
    }
    if (name === 'yeastar_get_outbound_route') {
      return textResult(await getOutboundRoute(creds!, { id: args.id as string }));
    }
    return errorResult(`Unknown tool: ${name}`);
  } catch (err) {
    return errorResult((err as Error).message);
  }
}
