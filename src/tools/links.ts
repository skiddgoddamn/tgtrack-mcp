import { z } from "zod";
import { tgPost, asText } from "../client.js";

function refusal(wouldDo: string): Promise<string> {
  return Promise.resolve(JSON.stringify({ refused: true, wouldDo, hint: "Повтори вызов с confirm:true, чтобы выполнить." }, null, 2));
}

// ── Лендинги интеграции ──

export const getLandingsSchema = z.object({
  chatID: z.string(),
  linkID: z.string().optional().describe("Ограничить одной интеграцией"),
});
export function handleGetLandings(p: z.infer<typeof getLandingsSchema>): Promise<string> {
  return asText(() => tgPost("/getLandings.php", p.linkID ? { chatID: p.chatID, linkID: p.linkID } : { chatID: p.chatID }));
}

// ── Ссылки ──

export const setLinkUrlSchema = z.object({
  chatID: z.string(),
  linkID: z.string(),
  targetUrl: z.string().describe("Новый целевой URL (напр. t.me-инвайт канала)"),
});
export function handleSetLinkUrl(p: z.infer<typeof setLinkUrlSchema>): Promise<string> {
  return asText(() => tgPost("/setLinkUrl.php", { chatID: p.chatID, linkID: p.linkID, targetUrl: p.targetUrl }));
}

export const setLinkNameSchema = z.object({
  chatID: z.string(),
  linkID: z.string(),
  name: z.string(),
  isOutbound: z.boolean().optional().describe("true для outbound-ссылок (кнопка под постом)"),
});
export function handleSetLinkName(p: z.infer<typeof setLinkNameSchema>): Promise<string> {
  const params = p.isOutbound
    ? { chatID: p.chatID, linkID: p.linkID, name: p.name, isOutbound: true }
    : { chatID: p.chatID, linkID: p.linkID, name: p.name };
  return asText(() => tgPost("/setAnyLinkName.php", params));
}

export const setOutboundLinkParamsSchema = z.object({
  linkID: z.string(),
  targetUrl: z.string(),
  buttonText: z.string().default(""),
  unsubscribedText: z.string().nullable().optional().describe("Текст для неподписанных (null — убрать)"),
  checkSubscription: z.boolean().optional(),
});
export function handleSetOutboundLinkParams(p: z.infer<typeof setOutboundLinkParamsSchema>): Promise<string> {
  return asText(() =>
    tgPost("/setOutboundLinkParams.php", {
      linkID: p.linkID,
      targetUrl: p.targetUrl,
      buttonText: p.buttonText ?? "",
      unsubscribedText: p.unsubscribedText ?? null,
      checkSubscription: p.checkSubscription ?? false,
    }),
  );
}

// ── Настройки канала ──

export const setChannelAutoApproveSchema = z.object({
  chatID: z.string(),
  autoApprove: z.boolean().describe("Авто-одобрение заявок на вступление"),
});
export function handleSetChannelAutoApprove(p: z.infer<typeof setChannelAutoApproveSchema>): Promise<string> {
  return asText(() => tgPost("/setChannelAutoApprove.php", { chatID: p.chatID, autoApprove: p.autoApprove }));
}

export const setReportSettingsSchema = z.object({
  chatID: z.string(),
  sendMorningReport: z.boolean().optional(),
  sendIfNoSubs: z.boolean().optional().describe("Присылать, даже если нет подписок/отписок"),
  sendTrafficReport: z.boolean().optional(),
});
export function handleSetReportSettings(p: z.infer<typeof setReportSettingsSchema>): Promise<string> {
  const { chatID, ...rest } = p;
  const settings = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
  return asText(() => tgPost("/reportSettings.php", { chatID, ...settings }));
}

// ── Удаление ссылок (опасно, за confirm) ──

export const deleteInviteLinkSchema = z.object({
  chatID: z.string(),
  linkID: z.string(),
  confirm: z.boolean().default(false),
});
export function handleDeleteInviteLink(p: z.infer<typeof deleteInviteLinkSchema>): Promise<string> {
  if (!p.confirm) return refusal(`Удалить invite-ссылку/интеграцию linkID=${p.linkID} канала ${p.chatID}. НЕОБРАТИМО (пропадёт статистика ссылки).`);
  return asText(() => tgPost("/deleteInviteLink.php", { chatID: p.chatID, linkID: p.linkID }));
}

export const deleteOutboundLinkSchema = z.object({
  chatID: z.string(),
  linkID: z.string(),
  confirm: z.boolean().default(false),
});
export function handleDeleteOutboundLink(p: z.infer<typeof deleteOutboundLinkSchema>): Promise<string> {
  if (!p.confirm) return refusal(`Удалить outbound-ссылку linkID=${p.linkID} канала ${p.chatID}. НЕОБРАТИМО.`);
  return asText(() => tgPost("/deleteOutboundLink.php", { chatID: p.chatID, linkID: p.linkID }));
}
