import { describe, it, expect } from "vitest";
import { buildSigned, md5 } from "../src/client";

describe("tgtrack signing", () => {
  it("md5 self-test", () => {
    expect(md5("hello")).toBe("5d41402abc4b2a76b9719d911017c592");
  });

  it("buildSigned produces stable JSON field order (params, T, tn) and H = md5(md5(JSON+T)+T)", () => {
    const { json, H } = buildSigned({ chatID: "test" }, 1000000000, "faketoken");
    expect(json).toBe('{"chatID":"test","T":1000000000,"tn":"faketoken"}');
    expect(H).toBe("ba5451008ee1fe48a7f7ff5699a99efc");
  });

  it("omits tn when no token given (disableAuth-style)", () => {
    const { json } = buildSigned({ chatID: "x" }, 42);
    expect(json).toBe('{"chatID":"x","T":42}');
  });

  it("H is a function of T (salt), not constant", () => {
    const a = buildSigned({ chatID: "x" }, 1).H;
    const b = buildSigned({ chatID: "x" }, 2).H;
    expect(a).not.toBe(b);
  });

  it("reproduces the live-sample JSON field order (stand-in token, real JWT not committed)", () => {
    // Live-verified sample was chat 600334c8b9b9e @ T=1783515346 -> H=f2405082c135d0b1e515222446c010ea.
    // We lock the exact JSON shape/field order that produced it, using a placeholder token.
    const { json } = buildSigned({ chatID: "600334c8b9b9e" }, 1783515346, "STANDIN");
    expect(json).toBe('{"chatID":"600334c8b9b9e","T":1783515346,"tn":"STANDIN"}');
  });

  // Note: the algorithm was verified during reverse-engineering against a live sample
  // (chat 600334c8b9b9e, T=1783515346 → H=f2405082c135d0b1e515222446c010ea). The real
  // JWT is intentionally NOT committed; the vector above uses a placeholder token.
});
