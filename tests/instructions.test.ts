import { describe, expect, test } from "vitest";
import { buildCoachInstruction } from "../src/instructions";

describe("buildCoachInstruction", () => {
  test("includes language configuration and mode", () => {
    const prompt = buildCoachInstruction({
      enabled: true,
      targetLanguage: "French",
      nativeLanguage: "Portuguese",
      mode: "normal",
      maxTips: 2,
    });

    expect(prompt).toContain("target language is French");
    expect(prompt).toContain("explanation language is Portuguese");
    expect(prompt).toContain("Mode: normal");
  });
});
