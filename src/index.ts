#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { randomUUID } from "node:crypto";
import { decodeJwtExp } from "./client.js";
import {
  listChannelsSchema, handleListChannels,
  getChannelSchema, handleGetChannel,
  getIntegrationScriptSchema, handleGetIntegrationScript,
} from "./tools/channels.js";
import {
  createIntegrationSchema, handleCreateIntegration,
  setScriptSettingsSchema, handleSetScriptSettings,
  updateGoalSchema, handleUpdateGoal,
  yandexWebCreateStatusSchema, handleYandexWebCreateStatus,
  getRestoreYandexLinkSchema, handleGetRestoreYandexLink,
} from "./tools/integrations.js";
import {
  getLandingsSchema, handleGetLandings,
  setLinkUrlSchema, handleSetLinkUrl,
  setLinkNameSchema, handleSetLinkName,
  setOutboundLinkParamsSchema, handleSetOutboundLinkParams,
  setChannelAutoApproveSchema, handleSetChannelAutoApprove,
  setReportSettingsSchema, handleSetReportSettings,
  deleteInviteLinkSchema, handleDeleteInviteLink,
  deleteOutboundLinkSchema, handleDeleteOutboundLink,
} from "./tools/links.js";
import {
  newApiTokenSchema, handleNewApiToken,
  newReportKeySchema, handleNewReportKey,
} from "./tools/tokens.js";
import {
  botEventUrlSchema, handleBotEventUrl,
  botStartedSchema, handleBotStarted,
  botUserStartedSchema, handleBotUserStarted,
  botStoppedSchema, handleBotStopped,
  botOnTelegramWebhookSchema, handleBotOnTelegramWebhook,
  botSendReachGoalSchema, handleBotSendReachGoal,
  botAddEventSchema, handleBotAddEvent,
  botGetUserInfoSchema, handleBotGetUserInfo,
} from "./tools/bot-api.js";

const TOOL_COUNT = 26;
const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

function createMcpServer(): McpServer {
  const server = new McpServer({ name: "tgtrack-mcp", version: "0.2.0" });

  // ── Чтение ──
  server.tool("tgtrack_list_channels", "Список всех каналов/групп/ботов пользователя в tgtrack.",
    listChannelsSchema.shape, async () => text(await handleListChannels()));
  server.tool("tgtrack_get_channel", "Полная инфа по каналу: интеграции (рекламные системы), ссылки, настройки скрипта и отчётов.",
    getChannelSchema.shape, async (p) => text(await handleGetChannel(p)));
  server.tool("tgtrack_get_integration_script", "Собрать готовый landing-скрипт + click-ссылку по linkID и counterID (без запроса к API).",
    getIntegrationScriptSchema.shape, async (p) => text(await handleGetIntegrationScript(p)));

  // ── Интеграции (рекламные системы) ──
  server.tool("tgtrack_create_integration", "Создать интеграцию («рекламную систему»). Для yandex вернёт grantAccessUrl + webCreationCode (нужно завершить OAuth в браузере).",
    createIntegrationSchema.shape, async (p) => text(await handleCreateIntegration(p)));
  server.tool("tgtrack_set_script_settings", "Изменить настройки скрипта интеграции (strictMode, conversionDelay, авто-одобрение, флаги целей и т.п.).",
    setScriptSettingsSchema.shape, async (p) => text(await handleSetScriptSettings(p)));
  server.tool("tgtrack_update_goal", "Обновить цель интеграции (имя/значение цели в Метрике), опционально создать её.",
    updateGoalSchema.shape, async (p) => text(await handleUpdateGoal(p)));
  server.tool("tgtrack_yandex_web_create_status", "Статус авто-создания целей в Яндексе по webCreationCode из create_integration.",
    yandexWebCreateStatusSchema.shape, async (p) => text(await handleYandexWebCreateStatus(p)));
  server.tool("tgtrack_get_restore_yandex_link", "Ссылка для восстановления/повторной выдачи Яндекс-доступа по интеграции.",
    getRestoreYandexLinkSchema.shape, async (p) => text(await handleGetRestoreYandexLink(p)));

  // ── Ссылки и настройки канала ──
  server.tool("tgtrack_get_landings", "Лендинги, привязанные к каналу/интеграции.",
    getLandingsSchema.shape, async (p) => text(await handleGetLandings(p)));
  server.tool("tgtrack_set_link_url", "Изменить целевой URL ссылки (targetUrl).",
    setLinkUrlSchema.shape, async (p) => text(await handleSetLinkUrl(p)));
  server.tool("tgtrack_set_link_name", "Переименовать ссылку/интеграцию.",
    setLinkNameSchema.shape, async (p) => text(await handleSetLinkName(p)));
  server.tool("tgtrack_set_outbound_link_params", "Параметры outbound-ссылки (кнопка под постом): targetUrl, текст кнопки, проверка подписки.",
    setOutboundLinkParamsSchema.shape, async (p) => text(await handleSetOutboundLinkParams(p)));
  server.tool("tgtrack_set_channel_auto_approve", "Вкл/выкл авто-одобрение заявок на вступление в канал.",
    setChannelAutoApproveSchema.shape, async (p) => text(await handleSetChannelAutoApprove(p)));
  server.tool("tgtrack_set_report_settings", "Настройки ежедневных отчётов канала (утренний отчёт, если нет подписок, отчёты по трафику).",
    setReportSettingsSchema.shape, async (p) => text(await handleSetReportSettings(p)));

  // ── Опасные (требуют confirm:true) ──
  server.tool("tgtrack_delete_invite_link", "⚠️ Удалить invite-ссылку/интеграцию (необратимо). Требует confirm:true.",
    deleteInviteLinkSchema.shape, async (p) => text(await handleDeleteInviteLink(p)));
  server.tool("tgtrack_delete_outbound_link", "⚠️ Удалить outbound-ссылку (необратимо). Требует confirm:true.",
    deleteOutboundLinkSchema.shape, async (p) => text(await handleDeleteOutboundLink(p)));
  server.tool("tgtrack_new_api_token", "⚠️ Создать новый API-ключ канала — ИНВАЛИДИРУЕТ предыдущий. Требует confirm:true.",
    newApiTokenSchema.shape, async (p) => text(await handleNewApiToken(p)));
  server.tool("tgtrack_new_report_key", "⚠️ Создать новый ключ отчётов — инвалидирует предыдущий. Требует confirm:true.",
    newReportKeySchema.shape, async (p) => text(await handleNewReportKey(p)));

  // ── Bot API (рантайм-события бота/канала: bot-api.tgtrack.ru, ключ apiToken) ──
  server.tool("tgtrack_bot_event_url", "Собрать URL bot-api для конструктора (например my_bothelp_was_started) — без запроса. Вставляется в webhook-блок бота.",
    botEventUrlSchema.shape, async (p) => text(await handleBotEventUrl(p)));
  server.tool("tgtrack_bot_started", "Событие «бот запущен» (ограниченная интеграция, my_bot_was_started): передать start_value (или auto_detect).",
    botStartedSchema.shape, async (p) => text(await handleBotStarted(p)));
  server.tool("tgtrack_bot_user_started", "Событие старта с данными пользователя (user_did_start_bot): user_id + имя (+start_value).",
    botUserStartedSchema.shape, async (p) => text(await handleBotUserStarted(p)));
  server.tool("tgtrack_bot_stopped", "Событие блокировки/отписки бота (my_bot_was_stopped) по user_id.",
    botStoppedSchema.shape, async (p) => text(await handleBotStopped(p)));
  server.tool("tgtrack_bot_on_telegram_webhook", "Полная интеграция: переслать сырой webhook Telegram 1:1 (on_telegram_webhook).",
    botOnTelegramWebhookSchema.shape, async (p) => text(await handleBotOnTelegramWebhook(p)));
  server.tool("tgtrack_bot_send_reach_goal", "Глубокая цель (send_reach_goal): пробросить достижение цели в рекламную систему, откуда пришёл пользователь.",
    botSendReachGoalSchema.shape, async (p) => text(await handleBotSendReachGoal(p)));
  server.tool("tgtrack_bot_add_event", "Событие жизненного цикла (add_event): шаг воронки/продажа с amount, conversion_target и labels.",
    botAddEventSchema.shape, async (p) => text(await handleBotAddEvent(p)));
  server.tool("tgtrack_bot_get_user_info", "Данные пользователя по user_id (get_user_info): utm-метки, даты подписки/отписки, источник.",
    botGetUserInfoSchema.shape, async (p) => text(await handleBotGetUserInfo(p)));

  return server;
}

async function startHttpMode(port: number) {
  const { StreamableHTTPServerTransport } = await import("@modelcontextprotocol/sdk/server/streamableHttp.js");
  const { createServer } = await import("node:http");
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID() });
  await server.connect(transport);
  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);
    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", tools: TOOL_COUNT }));
      return;
    }
    if (url.pathname === "/mcp") {
      if (req.method === "POST") {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const body = JSON.parse(Buffer.concat(chunks).toString());
        await transport.handleRequest(req, res, body);
      } else {
        await transport.handleRequest(req, res);
      }
      return;
    }
    res.writeHead(404);
    res.end("Not Found");
  });
  httpServer.listen(port, () => console.error(`[tgtrack-mcp] HTTP mode on :${port}/mcp — ${TOOL_COUNT} tools`));
}

function tokenNotice(): string {
  const t = process.env.TGTRACK_TOKEN;
  if (!t) return "TGTRACK_TOKEN НЕ задан — задай JWT из URL settings.tgtrack.ru (?t=...).";
  const exp = decodeJwtExp(t);
  if (!exp) return "TGTRACK_TOKEN задан (не удалось прочитать exp).";
  const hoursLeft = Math.round((exp * 1000 - Date.now()) / 3.6e6);
  return hoursLeft <= 0
    ? "TGTRACK_TOKEN ИСТЁК — обнови из URL settings.tgtrack.ru."
    : `TGTRACK_TOKEN задан, истекает через ~${hoursLeft}ч.`;
}

async function main() {
  const args = process.argv.slice(2);
  const httpMode = args.includes("--http");
  const portIdx = args.indexOf("--port");
  const parsedPort = parseInt(args[portIdx + 1] ?? "", 10);
  const port = portIdx !== -1 && Number.isFinite(parsedPort) ? parsedPort : 3001;

  if (httpMode) {
    await startHttpMode(port);
  } else {
    const server = createMcpServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(`[tgtrack-mcp] stdio. ${TOOL_COUNT} инструментов. ${tokenNotice()}`);
  }
}

main().catch((error) => {
  console.error("[tgtrack-mcp] Ошибка:", error);
  process.exit(1);
});

export { createMcpServer };
