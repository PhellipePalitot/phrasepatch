import { describe, expect, test } from "vitest";
import { resolveOptions } from "../src/options";

describe("resolveOptions", () => {
  test("uses defaults", () => {
    expect(resolveOptions({})).toEqual({
      enabled: true,
      targetLanguage: "English",
      nativeLanguage: "Portuguese",
      mode: "light",
      maxTips: 2,
      suggestFromNative: true,
    });
  });

  test("accepts supported configuration", () => {
    expect(
      resolveOptions({
        targetLanguage: "Spanish",
        nativeLanguage: "English",
        mode: "study",
        maxTips: 4,
        suggestFromNative: false,
      }),
    ).toMatchObject({
      targetLanguage: "Spanish",
      nativeLanguage: "English",
      mode: "study",
      maxTips: 4,
      suggestFromNative: false,
    });
  });

  test("rejects unsafe maxTips values", () => {
    expect(resolveOptions({ maxTips: 99 }).maxTips).toBe(2);
  });
});
