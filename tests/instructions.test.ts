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
      suggestFromNative: true,
    });

    expect(prompt).toContain("target language is French");
    expect(prompt).toContain("explanation language is Portuguese");
    expect(prompt).toContain("Mode: normal");
    expect(prompt).toContain("format the section as a clean markdown blockquote");
    expect(prompt).toContain("written primarily in Portuguese");
  });

  test("handles disabled suggestFromNative", () => {
    const prompt = buildCoachInstruction({
      enabled: true,
      targetLanguage: "English",
      nativeLanguage: "Portuguese",
      mode: "light",
      maxTips: 2,
      suggestFromNative: false,
    });

    expect(prompt).toContain("Ignore text written mainly in another language.");
  });
});

describe("buildReviewerSystemPrompt", () => {
  test("generates out-of-band reviewer prompt with language targets", async () => {
    const { buildReviewerSystemPrompt } = await import("../src/instructions");
    const prompt = buildReviewerSystemPrompt({
      enabled: true,
      targetLanguage: "English",
      nativeLanguage: "Portuguese",
      mode: "light",
      maxTips: 2,
      suggestFromNative: true,
    });

    expect(prompt).toContain("Target language: English");
    expect(prompt).toContain("Explanation language: Portuguese");
    expect(prompt).toContain("PhrasePatch (score/10)");
    expect(prompt).toContain("Output ONLY: OMIT");
    expect(prompt).toContain("DO NOT answer the user's technical question");
  });
});

