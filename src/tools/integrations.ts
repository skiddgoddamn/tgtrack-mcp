import { z } from "zod";
import { tgPost, asText } from "../client.js";

// ── Создание интеграции («рекламной системы») ──

export const createIntegrationSchema = z.object({
  chatID: z.string().describe("ID канала tgtrack"),
  integrationType: z
    .enum(["yandex", "website", "google", "vk", "facebook", "keytaro"])
    .default("yandex")
    .describe("Тип рекламной системы. Для лендинга с Метрикой — yandex."),
  linkName: z.string().describe("Название интеграции (напр. «Яндекс Директ», «Лендинг Tilda»)"),
  counterNumber: z.string().optional().describe("Номер счётчика Я.Метрики (для yandex/website)"),
  withMetrikaCounter: z.boolean().default(true).describe("На странице есть счётчик Я.Метрики"),
  goalSubscribe: z.string().default("userDidSubscribe"),
  goalToChannel: z.string().default("toTelegram"),
  enableGoalOpenTelegram: z.boolean().default(true),
  goalOpenTelegram: z.string().default("userDidOpenTelegram"),
  accessToken: z.string().optional().describe("OAuth access token (когда нужен ручной токен)"),
  closedInviteTargetUrl: z.string().optional().describe("Целевой URL для закрытого инвайта"),
  enableLinkAutoApprove: z.boolean().optional(),
  linkAutoApproveDelay: z.number().optional(),
});
export function handleCreateIntegration(p: z.infer<typeof createIntegrationSchema>): Promise<string> {
  const payload: Record<string, unknown> = {
    chatID: p.chatID,
    integrationType: p.integrationType,
    linkName: p.linkName,
    counterNumber: p.counterNumber ?? "",
    withMetrikaCounter: p.withMetrikaCounter,
    goalSubscribe: p.goalSubscribe,
    goalToChannel: p.goalToChannel,
  };
  if (p.enableGoalOpenTelegram) payload.goalDidOpenTelegram = p.goalOpenTelegram;
  if (p.accessToken) payload.accessToken = p.accessToken;
  if (p.closedInviteTargetUrl) {
    payload.targetUrl = p.closedInviteTargetUrl;
    payload.linkAutoApprove = p.enableLinkAutoApprove ? p.linkAutoApproveDelay ?? 0 : -1;
  }
  return asText(async () => {
    const data = await tgPost("/createIntegration.php", payload);
    return {
      data,
      note:
        p.integrationType === "yandex"
          ? "Для Яндекса ответ содержит grantAccessUrl + webCreationCode: открой grantAccessUrl в браузере и заверши OAuth-доступ, чтобы tgtrack создал цели и слал офлайн-конверсии в Метрику. Статус создания проверяй через yandex_web_create_status."
          : undefined,
    };
  });
}

// ── Настройки скрипта интеграции ──

export const setScriptSettingsSchema = z.object({
  chatID: z.string(),
  linkID: z.string().describe("linkID интеграции"),
  autoApprove: z.number().optional(),
  conversionDelay: z.number().optional(),
  strictMode: z.boolean().optional(),
  leadMagnetSubscriber: z.boolean().optional(),
  trackThroughWebApp: z.boolean().optional(),
  sendGoalDidOpenTelegram: z.boolean().optional(),
  sendGoalStayedInChannel: z.boolean().optional(),
  stayedInChannelCheckDelay: z.number().optional(),
});
export function handleSetScriptSettings(p: z.infer<typeof setScriptSettingsSchema>): Promise<string> {
  const { chatID, ...rest } = p;
  const settings = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
  return asText(() => tgPost("/setScriptSettings.php", { chatID, ...settings }));
}

// ── Обновление цели ──

export const updateGoalSchema = z.object({
  chatID: z.string(),
  linkID: z.string(),
  goalName: z.string().describe("Имя цели (напр. userDidSubscribe / toTelegram / userDidOpenTelegram)"),
  goalValue: z.string().describe("Новое значение идентификатора цели в Метрике"),
  needToCreateGoal: z.boolean().default(false).describe("Создать цель в Метрике, если её ещё нет"),
});
export function handleUpdateGoal(p: z.infer<typeof updateGoalSchema>): Promise<string> {
  return asText(() =>
    tgPost("/updateGoal.php", {
      chatID: p.chatID,
      linkID: p.linkID,
      needToCreateGoal: p.needToCreateGoal,
      goal: { name: p.goalName, value: p.goalValue },
    }),
  );
}

// ── Яндекс: статус авто-создания целей / ссылка восстановления доступа ──

export const yandexWebCreateStatusSchema = z.object({
  chatID: z.string(),
  webCreationCode: z.string().describe("Код из ответа create_integration (yandex)"),
});
export function handleYandexWebCreateStatus(p: z.infer<typeof yandexWebCreateStatusSchema>): Promise<string> {
  return asText(() => tgPost("/yandexWebCreateStatus.php", { chatID: p.chatID, webCreationCode: p.webCreationCode }));
}

export const getRestoreYandexLinkSchema = z.object({
  linkID: z.string().describe("linkID интеграции Яндекса"),
});
export function handleGetRestoreYandexLink(p: z.infer<typeof getRestoreYandexLinkSchema>): Promise<string> {
  return asText(() => tgPost("/getRestoreYandexLink.php", { linkID: p.linkID }));
}
