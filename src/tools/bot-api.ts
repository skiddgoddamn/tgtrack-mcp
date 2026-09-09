import { z } from "zod";
import { asText, TgtrackError } from "../client.js";

/**
 * Bot API tgtrack («Откуда Подписки») — рантайм-события бота/канала.
 *
 * Отдельный от settings-API контур: НЕ подписывается JWT+md5, а бьёт в
 * `https://bot-api.tgtrack.ru/v1/<API_KEY>/<method>` (MAX: `https://max.tgtrack.ru/API/bot-api/v1/<API_KEY>/<method>`)
 * POST-ом с JSON-телом. Ключ — per-bot/канал `apiToken` (см. get_channel), НЕ JWT.
 * Ответ: `{ status:"OK", data? }` или `{ status:"error", error_code, error_description, error_details? }`.
 * Док: https://doc.tgtrack.ru/doc/custom-bot-api + полная спека (Google Doc "TGTrack service API").
 */

const BOT_BASE = process.env.TGTRACK_BOT_API_BASE || "https://bot-api.tgtrack.ru/v1";
const BOT_BASE_MAX = process.env.TGTRACK_BOT_API_BASE_MAX || "https://max.tgtrack.ru/API/bot-api/v1";
const TIMEOUT = 20_000;

function resolveKey(explicit?: string): string {
  const key = explicit || process.env.TGTRACK_BOT_API_KEY;
  if (!key) {
    throw new TgtrackError(
      401,
      "Не задан apiKey бота. Передай apiKey (ключ канала/бота — поле apiToken в get_channel) или задай env TGTRACK_BOT_API_KEY.",
    );
  }
  return key;
}

/** Собрать URL bot-api (без запроса). Экспортируется для тестов. */
export function botUrl(key: string, method: string, max = false): string {
  return `${max ? BOT_BASE_MAX : BOT_BASE}/${key}/${method}`;
}

async function botPost(
  apiKey: string | undefined,
  method: string,
  body: Record<string, unknown>,
  max = false,
): Promise<unknown> {
  const url = botUrl(resolveKey(apiKey), method, max);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      body: JSON.stringify(body),
      signal: controller.signal,
      headers: { "content-type": "application/json", accept: "application/json" },
    });
  } catch (e) {
    clearTimeout(timer);
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new TgtrackError(0, `Таймаут bot-api ${method} (${TIMEOUT}мс)`);
    }
    throw new TgtrackError(0, `Сетевая ошибка bot-api ${method}: ${(e as Error).message}`);
  }
  clearTimeout(timer);

  const text = await res.text();
  let json: {
    status?: string;
    data?: unknown;
    mode?: string;
    error_code?: number;
    error_description?: string;
    error_details?: string;
  };
  try {
    json = JSON.parse(text);
  } catch {
    throw new TgtrackError(res.status, `Не-JSON ответ bot-api ${method} (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }

  if (json.status === "OK") {
    return json.data ?? { status: "OK", mode: json.mode };
  }
  const code = json.error_code ?? res.status;
  const msg =
    [json.error_description, json.error_details].filter(Boolean).join(" — ") || `bot-api ошибка (HTTP ${res.status})`;
  throw new TgtrackError(code, msg);
}

// ── Билдер URL события (без запроса) — чтобы вставить в конструктор бота ──

export const botEventUrlSchema = z.object({
  apiKey: z.string().optional().describe("API-ключ бота/канала из tgtrack (get_channel → apiToken). Иначе env TGTRACK_BOT_API_KEY."),
  method: z
    .string()
    .default("my_bothelp_was_started")
    .describe("Метод bot-api: my_bothelp_was_started | my_bot_was_started | my_bot_was_stopped | user_did_start_bot | send_reach_goal | add_event | on_telegram_webhook | sambot_on_tg_webhook | win_win_was_started …"),
  max: z.boolean().default(false).describe("MAX вместо Telegram"),
});
export function handleBotEventUrl(p: z.infer<typeof botEventUrlSchema>): Promise<string> {
  return asText(async () => ({
    url: botUrl(resolveKey(p.apiKey), p.method, p.max),
    lastEventsCheck: p.max ? "https://max.tgtrack.ru/API/last_events/" : "https://bot-api.tgtrack.ru/last_events/",
    note:
      "Вставь url POST-ом в блок конструктора (BotHelp: «Отправить данные подписчика через Webhook» на шаге старта). Долетевшие события смотри по ключу на lastEventsCheck.",
  }));
}

// ── События бота: старт/стоп ──

export const botStartedSchema = z.object({
  apiKey: z.string().optional(),
  startValue: z.string().default("auto_detect").describe("Значение start-параметра. auto_detect — если конструктор его не отдаёт."),
});
export function handleBotStarted(p: z.infer<typeof botStartedSchema>): Promise<string> {
  // my_bot_was_started — ограниченная интеграция, только Telegram
  return asText(() => botPost(p.apiKey, "my_bot_was_started", { start_value: p.startValue }));
}

export const botUserStartedSchema = z.object({
  apiKey: z.string().optional(),
  userId: z.string().describe("Telegram user_id"),
  firstName: z.string().describe("Имя пользователя"),
  lastName: z.string().optional(),
  username: z.string().optional(),
  fullName: z.string().optional(),
  startValue: z.string().optional().describe("start-параметр запуска бота, если известен"),
  max: z.boolean().default(false),
});
export function handleBotUserStarted(p: z.infer<typeof botUserStartedSchema>): Promise<string> {
  const body: Record<string, unknown> = { user_id: p.userId, first_name: p.firstName };
  if (p.lastName) body.last_name = p.lastName;
  if (p.username) body.username = p.username;
  if (p.fullName) body.full_name = p.fullName;
  if (p.startValue) body.start_value = p.startValue;
  return asText(() => botPost(p.apiKey, "user_did_start_bot", body, p.max));
}

export const botStoppedSchema = z.object({
  apiKey: z.string().optional(),
  userId: z.string().describe("ID пользователя, заблокировавшего бота"),
  date: z.number().int().optional().describe("unixtime события; по умолчанию — текущее"),
});
export function handleBotStopped(p: z.infer<typeof botStoppedSchema>): Promise<string> {
  const body: Record<string, unknown> = { user_id: p.userId };
  if (p.date !== undefined) body.date = p.date;
  // my_bot_was_stopped — только Telegram
  return asText(() => botPost(p.apiKey, "my_bot_was_stopped", body));
}

export const botOnTelegramWebhookSchema = z.object({
  apiKey: z.string().optional(),
  update: z.record(z.unknown()).describe("Сырой webhook-объект от Telegram (переслать 1:1, без обработки)"),
});
export function handleBotOnTelegramWebhook(p: z.infer<typeof botOnTelegramWebhookSchema>): Promise<string> {
  // on_telegram_webhook — тело = сам update от телеграма, только Telegram
  return asText(() => botPost(p.apiKey, "on_telegram_webhook", p.update));
}

// ── Глубокие цели и события воронки ──

export const botSendReachGoalSchema = z.object({
  apiKey: z.string().optional(),
  userId: z.string().describe("Telegram user_id"),
  target: z.string().describe("Идентификатор цели в рекламной системе (уйдёт в Яндекс/ФБ/ВК/Гугл). Окно 21 день."),
  max: z.boolean().default(false),
});
export function handleBotSendReachGoal(p: z.infer<typeof botSendReachGoalSchema>): Promise<string> {
  return asText(() => botPost(p.apiKey, "send_reach_goal", { user_id: p.userId, target: p.target }, p.max));
}

const labelSchema = z.object({ name: z.string(), value: z.string() });

export const botAddEventSchema = z.object({
  apiKey: z.string().optional(),
  userId: z.string(),
  eventType: z.string().describe("Тип события (шаг воронки), считается в отчётах"),
  eventResult: z.enum(["in_progress", "success", "failure"]).optional().describe("Результат шага. По умолчанию in_progress."),
  date: z.number().int().optional().describe("unixtime; по умолчанию текущее"),
  conversionTarget: z.string().optional().describe("Цель, которая уйдёт в рекламную систему (окно 21 день)"),
  amount: z.number().optional().describe("Сумма: + выручка, − затраты"),
  labels: z.array(labelSchema).optional().describe("Доп. аналитические метки [{name,value}]"),
  max: z.boolean().default(false),
});
/** Тело add_event в snake_case (пустые опции опускаются). Экспортируется для тестов. */
export function buildAddEventBody(p: z.infer<typeof botAddEventSchema>): Record<string, unknown> {
  const body: Record<string, unknown> = { user_id: p.userId, event_type: p.eventType };
  if (p.eventResult) body.event_result = p.eventResult;
  if (p.date !== undefined) body.date = p.date;
  if (p.conversionTarget) body.conversion_target = p.conversionTarget;
  if (p.amount !== undefined) body.amount = p.amount;
  if (p.labels) body.labels = p.labels;
  return body;
}
export function handleBotAddEvent(p: z.infer<typeof botAddEventSchema>): Promise<string> {
  return asText(() => botPost(p.apiKey, "add_event", buildAddEventBody(p), p.max));
}

// ── Чтение: данные пользователя (utm-метки, даты подписки) ──

export const botGetUserInfoSchema = z.object({
  apiKey: z.string().optional(),
  userId: z.string().describe("Telegram user_id"),
  max: z.boolean().default(false),
});
export function handleBotGetUserInfo(p: z.infer<typeof botGetUserInfoSchema>): Promise<string> {
  return asText(() => botPost(p.apiKey, "get_user_info", { user_id: p.userId }, p.max));
}
