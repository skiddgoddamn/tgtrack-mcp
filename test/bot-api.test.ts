import { describe, it, expect } from "vitest";
import { botUrl, buildAddEventBody } from "../src/tools/bot-api";

describe("tgtrack bot-api", () => {
  it("botUrl builds the Telegram endpoint", () => {
    expect(botUrl("KEY123", "my_bothelp_was_started")).toBe(
      "https://bot-api.tgtrack.ru/v1/KEY123/my_bothelp_was_started",
    );
  });

  it("botUrl builds the MAX endpoint when max=true", () => {
    expect(botUrl("KEY123", "get_user_info", true)).toBe(
      "https://max.tgtrack.ru/API/bot-api/v1/KEY123/get_user_info",
    );
  });

  it("buildAddEventBody maps camelCase to snake_case and keeps required fields", () => {
    expect(buildAddEventBody({ userId: "42", eventType: "sale", max: false } as never)).toEqual({
      user_id: "42",
      event_type: "sale",
    });
  });

  it("buildAddEventBody includes optionals only when set", () => {
    const body = buildAddEventBody({
      userId: "42",
      eventType: "sale",
      eventResult: "success",
      date: 1622520000,
      conversionTarget: "lead",
      amount: 1500,
      labels: [{ name: "manager", value: "Jane" }],
      max: false,
    } as never);
    expect(body).toEqual({
      user_id: "42",
      event_type: "sale",
      event_result: "success",
      date: 1622520000,
      conversion_target: "lead",
      amount: 1500,
      labels: [{ name: "manager", value: "Jane" }],
    });
  });

  it("buildAddEventBody keeps amount:0 (falsy but meaningful) and drops undefined", () => {
    const body = buildAddEventBody({ userId: "1", eventType: "x", amount: 0, max: false } as never);
    expect(body).toEqual({ user_id: "1", event_type: "x", amount: 0 });
  });
});
