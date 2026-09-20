import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { SYSTEM_TOOLS, handleSystemTool, isSystemTool } from './system.js';
import { EXTENSION_TOOLS, handleExtensionTool, isExtensionTool } from './extensions.js';
import { EXTENSION_GROUP_TOOLS, handleExtensionGroupTool, isExtensionGroupTool } from './extension-groups.js';
import { TRUNK_TOOLS, handleTrunkTool, isTrunkTool } from './trunks.js';
import { ROUTE_TOOLS, handleRouteTool, isRouteTool } from './routes.js';
import { IVR_TOOLS, handleIvrTool, isIvrTool } from './ivr.js';
import { RING_GROUP_TOOLS, handleRingGroupTool, isRingGroupTool } from './ring-groups.js';
import { QUEUE_TOOLS, handleQueueTool, isQueueTool } from './queues.js';
import { DIRECTORY_TOOLS, handleDirectoryTool, isDirectoryTool } from './directory.js';
import { CDR_TOOLS, handleCdrTool, isCdrTool } from './cdr.js';
import { CALL_REPORT_TOOLS, handleCallReportTool, isCallReportTool } from './call-reports.js';
import { BACKUP_TOOLS, handleBackupTool, isBackupTool } from './backups.js';
import { CERTIFICATE_TOOLS, handleCertificateTool, isCertificateTool } from './certificates.js';
import type { CallToolResult } from './types.js';

export const ALL_TOOLS: Tool[] = [
  ...SYSTEM_TOOLS,
  ...EXTENSION_TOOLS,
  ...EXTENSION_GROUP_TOOLS,
  ...TRUNK_TOOLS,
  ...ROUTE_TOOLS,
  ...IVR_TOOLS,
  ...RING_GROUP_TOOLS,
  ...QUEUE_TOOLS,
  ...DIRECTORY_TOOLS,
  ...CDR_TOOLS,
  ...CALL_REPORT_TOOLS,
  ...BACKUP_TOOLS,
  ...CERTIFICATE_TOOLS,
];

export async function dispatchToolCall(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  if (isSystemTool(name)) return handleSystemTool(name, args);
  if (isExtensionTool(name)) return handleExtensionTool(name, args);
  if (isExtensionGroupTool(name)) return handleExtensionGroupTool(name, args);
  if (isTrunkTool(name)) return handleTrunkTool(name, args);
  if (isRouteTool(name)) return handleRouteTool(name, args);
  if (isIvrTool(name)) return handleIvrTool(name, args);
  if (isRingGroupTool(name)) return handleRingGroupTool(name, args);
  if (isQueueTool(name)) return handleQueueTool(name, args);
  if (isDirectoryTool(name)) return handleDirectoryTool(name, args);
  if (isCdrTool(name)) return handleCdrTool(name, args);
  if (isCallReportTool(name)) return handleCallReportTool(name, args);
  if (isBackupTool(name)) return handleBackupTool(name, args);
  if (isCertificateTool(name)) return handleCertificateTool(name, args);
  return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
}
