#!/usr/bin/env node
// Прямой CLI: вызвать инструмент tgtrack-mcp без MCP-транспорта (для скриптов/отладки).
//   npx tsx src/run.ts <tool> '<json params>'
//   TGTRACK_TOKEN=... node dist/run.js tgtrack_get_channel '{"chatID":"600334c8b9b9e"}'
import * as channels from "./tools/channels.js";
import * as integrations from "./tools/integrations.js";
import * as links from "./tools/links.js";
import * as tokens from "./tools/tokens.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const H: Record<string, (p: any) => Promise<string>> = {
  tgtrack_list_channels: () => channels.handleListChannels(),
  tgtrack_get_channel: channels.handleGetChannel,
  tgtrack_get_integration_script: channels.handleGetIntegrationScript,
  tgtrack_create_integration: integrations.handleCreateIntegration,
  tgtrack_set_script_settings: integrations.handleSetScriptSettings,
  tgtrack_update_goal: integrations.handleUpdateGoal,
  tgtrack_yandex_web_create_status: integrations.handleYandexWebCreateStatus,
  tgtrack_get_restore_yandex_link: integrations.handleGetRestoreYandexLink,
  tgtrack_get_landings: links.handleGetLandings,
  tgtrack_set_link_url: links.handleSetLinkUrl,
  tgtrack_set_link_name: links.handleSetLinkName,
  tgtrack_set_outbound_link_params: links.handleSetOutboundLinkParams,
  tgtrack_set_channel_auto_approve: links.handleSetChannelAutoApprove,
  tgtrack_set_report_settings: links.handleSetReportSettings,
  tgtrack_delete_invite_link: links.handleDeleteInviteLink,
  tgtrack_delete_outbound_link: links.handleDeleteOutboundLink,
  tgtrack_new_api_token: tokens.handleNewApiToken,
  tgtrack_new_report_key: tokens.handleNewReportKey,
};

const [tool, jsonArg] = process.argv.slice(2);
if (!tool || !H[tool]) {
  console.error("Usage: tsx src/run.ts <tool> '<json params>'");
  console.error("Tools:\n  " + Object.keys(H).join("\n  "));
  process.exit(2);
}
const params = jsonArg ? JSON.parse(jsonArg) : {};
H[tool](params)
  .then((out) => console.log(out))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
