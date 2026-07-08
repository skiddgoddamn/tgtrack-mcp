import crypto from "node:crypto";

/**
 * Клиент внутреннего API tgtrack / «Откуда Подписки» (settings.tgtrack.ru).
 *
 * Реверс-инжиниринг панели (2026-07): у tgtrack нет публичного API, панель ходит
 * в `https://api.tgtrack.ru/API/settings/*.php`. Запрос — multipart/form-data с двумя
 * полями:
 *   JSON = JSON.stringify({ ...params, T, tn })   // T = unix-секунды, tn = JWT
 *   H    = md5( md5(JSON + T) + T )                // подпись; секрета нет, соль = T
 * Ответ — конверт { S, D, M }: S===0 успех (payload = D.data), иначе ошибка (код S, текст M).
 */

const BASE = process.env.TGTRACK_BASE_URL || "https://api.tgtrack.ru/API/settings";
const TIMEOUT = 20_000;

export const AUTH_BAD_TOKEN = 217;
export const AUTH_TOKEN_EXPIRED = 218;

export class TgtrackError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.name = "TgtrackError";
    this.code = code;
  }
}

export function md5(s: string): string {
  return crypto.createHash("md5").update(s, "utf8").digest("hex");
}

/** Прочитать JWT из env (панель кладёт его в URL `?t=` и в cookie `tgtrack_token`). */
export function getToken(): string {
  const t = process.env.TGTRACK_TOKEN;
  if (!t) {
    throw new TgtrackError(
      AUTH_BAD_TOKEN,
      "TGTRACK_TOKEN не задан. Открой settings.tgtrack.ru и скопируй значение параметра `t=` из адресной строки (или cookie `tgtrack_token`) в переменную окружения TGTRACK_TOKEN.",
    );
  }
  return t;
}

/** Достать `exp` (unix-секунды) из JWT — для предупреждения об истечении. */
export function decodeJwtExp(token: string): number | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

/**
 * Построить подписанное тело запроса. Детерминировано при фиксированных ts/token —
 * используется в юнит-тестах против известного вектора.
 */
export function buildSigned(
  params: Record<string, unknown>,
  ts: number,
  token?: string,
): { json: string; H: string } {
  const obj: Record<string, unknown> = { ...params, T: ts };
  if (token) obj.tn = token;
  const json = JSON.stringify(obj);
  const H = md5(md5(json + ts) + ts);
  return { json, H };
}

function messageForCode(S: number): string {
  if (S >= 200 && S < 250) return `Ошибка авторизации (код ${S})`;
  if (S >= 250 && S < 300) return `Ошибка регистрации (код ${S})`;
  if (S >= 300 && S < 400) return `Ошибка данных (код ${S})`;
  if (S >= 400 && S < 500) return `Ошибка приложения (код ${S})`;
  if (S >= 500 && S < 600) return `Ошибка сервера (код ${S})`;
  if (S >= 800 && S < 900) return `Ошибка API (код ${S})`;
  return `Неизвестная ошибка (код ${S})`;
}

export interface PostOptions {
  /** Не прикреплять токен (для эндпоинтов, работающих без авторизации). */
  disableAuth?: boolean;
}

/**
 * POST к settings-API tgtrack: подписывает, отправляет multipart, разворачивает конверт.
 * Возвращает `D.data`. Кидает `TgtrackError` при `S!==0`.
 */
export async function tgPost<T = unknown>(
  endpoint: string,
  params: Record<string, unknown> = {},
  opts: PostOptions = {},
): Promise<T> {
  const ts = Math.floor(Date.now() / 1000);
  const token = opts.disableAuth ? undefined : getToken();
  const { json, H } = buildSigned(params, ts, token);

  const form = new FormData();
  form.append("JSON", json);
  form.append("H", H);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  let res: Response;
  try {
    res = await fetch(`${BASE}${endpoint}`, {
      method: "POST",
      body: form,
      signal: controller.signal,
      headers: { accept: "application/json, text/plain, */*" },
    });
  } catch (e) {
    clearTimeout(timer);
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new TgtrackError(0, `Таймаут запроса к ${endpoint} (${TIMEOUT}мс)`);
    }
    throw new TgtrackError(0, `Сетевая ошибка ${endpoint}: ${(e as Error).message}`);
  }
  clearTimeout(timer);

  const text = await res.text();
  let body: { S?: number; D?: { data?: unknown } | unknown; M?: string };
  try {
    body = JSON.parse(text);
  } catch {
    throw new TgtrackError(res.status, `Не-JSON ответ от ${endpoint} (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }

  const S = body.S;
  if (S === 0) {
    const d = body.D;
    if (d && typeof d === "object" && "data" in d) {
      return (d as { data?: unknown }).data as T;
    }
    return (d ?? null) as T;
  }

  const code = typeof S === "number" ? S : res.status;
  const msg = body.M || messageForCode(code);
  if (code === AUTH_BAD_TOKEN || code === AUTH_TOKEN_EXPIRED) {
    throw new TgtrackError(
      code,
      `Токен недействителен/истёк (код ${code}). Обнови TGTRACK_TOKEN: открой settings.tgtrack.ru и скопируй свежий параметр \`t=\` из адресной строки. ${msg}`,
    );
  }
  throw new TgtrackError(code, msg);
}

/** Обёртка: выполнить хэндлер и вернуть текст (JSON или сообщение об ошибке) для MCP. */
export async function asText(fn: () => Promise<unknown>): Promise<string> {
  try {
    const out = await fn();
    return typeof out === "string" ? out : JSON.stringify(out, null, 2);
  } catch (e) {
    if (e instanceof TgtrackError) {
      return JSON.stringify({ error: { code: e.code, message: e.message } }, null, 2);
    }
    return JSON.stringify({ error: { code: 0, message: (e as Error).message } }, null, 2);
  }
}

export { BASE };
