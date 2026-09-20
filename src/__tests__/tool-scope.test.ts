import { describe, expect, it } from 'vitest';
import { ALL_TOOLS } from '../tools/index.js';

/**
 * Hard scope boundary (see README's Scope section for the full accounting
 * against Yeastar's documented API surface): this connector must NEVER
 * expose a tool that returns a live extension/portal password, or that
 * creates/updates/deletes/dials/hangs-up/logs-in-an-agent/downloads bulk
 * content. Pin the exact tool set so an accidental addition - a
 * copy-pasted "get_extension_password", "create_extension", "call_dial",
 * "agent_login", "download_recording", or any other write/control/
 * credential-exposing tool - fails this test immediately rather than
 * silently shipping.
 */
describe('ALL_TOOLS scope boundary', () => {
  const EXPECTED_TOOL_NAMES = [
    // System
    'yeastar_get_system_information',
    'yeastar_get_system_capacity',
    // Extensions
    'yeastar_list_extensions',
    'yeastar_get_extension',
    // Extension Groups
    'yeastar_list_extension_groups',
    'yeastar_get_extension_group',
    // Trunks
    'yeastar_list_trunks',
    'yeastar_get_trunk',
    'yeastar_list_itsp_trunks',
    // Routes
    'yeastar_list_inbound_routes',
    'yeastar_get_inbound_route',
    'yeastar_list_outbound_routes',
    'yeastar_get_outbound_route',
    // IVR
    'yeastar_list_ivrs',
    'yeastar_get_ivr',
    // Ring Groups
    'yeastar_list_ring_groups',
    'yeastar_get_ring_group',
    // Queues
    'yeastar_list_queues',
    'yeastar_get_queue',
    'yeastar_get_queue_call_status',
    'yeastar_get_queue_agent_status',
    // Directory
    'yeastar_list_company_contacts',
    // CDR
    'yeastar_list_cdr',
    // Call Reports
    'yeastar_list_call_reports',
    // Backups
    'yeastar_list_backups',
    // Certificates
    'yeastar_list_certificates',
  ].sort();

  it("exposes exactly this connector's 26 read-only tools - nothing more, nothing less", () => {
    const names = ALL_TOOLS.map((t) => t.name).sort();
    expect(names).toEqual(EXPECTED_TOOL_NAMES);
    expect(names).toHaveLength(26);
  });

  it('never exposes a password/credential-exposing, write, delete, call-control, or agent-control tool', () => {
    // Forbidden as a whole underscore-token, not a substring - so this does
    // NOT false-positive on e.g. 'yeastar_get_system_capacity' or any
    // 'list'/'get' tool name.
    const FORBIDDEN_TOKENS = new Set([
      'password',
      'getpassword',
      'pwd',
      'secret',
      'create',
      'update',
      'delete',
      'upload',
      'download',
      'dial',
      'hangup',
      'accept',
      'refuse',
      'hold',
      'unhold',
      'mute',
      'unmute',
      'park',
      'transfer',
      'record',
      'login',
      'pause',
      'unpause',
      'kick',
      'invite',
      'checkout',
      'send',
      'retry',
      'archive',
      'close',
      'reboot',
      'reprovision',
      'batchcreate',
      'batchupdate',
      'batchdelete',
      'batchreboot',
      'batchreprovision',
    ]);

    for (const tool of ALL_TOOLS) {
      const tokens = tool.name.split('_');
      for (const token of tokens) {
        expect(
          FORBIDDEN_TOKENS.has(token),
          `Tool "${tool.name}" contains forbidden token "${token}" - this connector must stay read-only, non-credential-exposing, and free of call/agent control.`
        ).toBe(false);
      }
    }
  });

  it('every tool name is prefixed with yeastar_', () => {
    for (const tool of ALL_TOOLS) {
      expect(tool.name.startsWith('yeastar_')).toBe(true);
    }
  });
});
