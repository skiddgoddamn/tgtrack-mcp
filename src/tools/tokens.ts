import { z } from "zod";
import { tgPost, asText } from "../client.js";

function refusal(wouldDo: string): Promise<string> {
  return Promise.resolve(JSON.stringify({ refused: true, wouldDo, hint: "Повтори вызов с confirm:true, чтобы выполнить." }, null, 2));
}

// ── Ротация ключей (опасно: инвалидирует предыдущий) ──

export const newApiTokenSchema = z.object({
  chatID: z.string(),
  confirm: z.boolean().default(false),
});
export function handleNewApiToken(p: z.infer<typeof newApiTokenSchema>): Promise<string> {
  if (!p.confirm) {
    return refusal(
      `Создать новый API-ключ («ключ для интеграций») канала ${p.chatID}. ПРЕДЫДУЩИЙ КЛЮЧ БУДЕТ ИНВАЛИДИРОВАН — это сломает всё, что использует старый ключ.`,
    );
  }
  return asText(() => tgPost("/newApiToken.php", { chatID: p.chatID }));
}

export const newReportKeySchema = z.object({
  chatID: z.string(),
  confirm: z.boolean().default(false),
});
export function handleNewReportKey(p: z.infer<typeof newReportKeySchema>): Promise<string> {
  if (!p.confirm) {
    return refusal(`Создать новый ключ отчётов канала ${p.chatID}. Предыдущий ключ отчётов будет инвалидирован.`);
  }
  return asText(() => tgPost("/newReportKey.php", { chatID: p.chatID }));
}
