import { z } from "zod";
import { tgPost, asText } from "../client.js";

// ── Чтение ──

export const listChannelsSchema = z.object({});
export function handleListChannels(): Promise<string> {
  return asText(() => tgPost("/channels.php", {}));
}

export const getChannelSchema = z.object({
  chatID: z.string().describe("ID канала tgtrack (виден в URL панели ?chat=..., напр. 600334c8b9b9e)"),
});
export function handleGetChannel(p: z.infer<typeof getChannelSchema>): Promise<string> {
  return asText(() => tgPost("/channel.php", { chatID: p.chatID }));
}

// ── Вспомогательное: собрать готовый landing-скрипт + click-ссылку (без запроса к API) ──

export const getIntegrationScriptSchema = z.object({
  linkID: z.string().describe("linkID интеграции (из get_channel → integrations[].linkID)"),
  counterID: z.string().describe("Номер счётчика Яндекс.Метрики, привязанного к интеграции"),
});
export function handleGetIntegrationScript(p: z.infer<typeof getIntegrationScriptSchema>): Promise<string> {
  const script = `<script src="https://api.tgtrack.ru/API/landing_script/v1/?linkID=${p.linkID}&type=ya&counterID=${p.counterID}" type="text/javascript" defer></script>`;
  const clickLink = `https://click.tgtrack.ru/${p.linkID}`;
  return Promise.resolve(
    JSON.stringify(
      {
        script,
        clickLink,
        note:
          "Вставь <script> в код-блок/`<head>` лендинга. Кнопку на Tilda веди на прямой t.me-инвайт канала — landing_script трекает переход сам (не подменяй кнопку на click.tgtrack.ru).",
      },
      null,
      2,
    ),
  );
}
