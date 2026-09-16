export type PhrasePatchMode = "light" | "normal" | "study";

export interface PhrasePatchOptions {
  enabled: boolean;
  targetLanguage: string;
  nativeLanguage: string;
  mode: PhrasePatchMode;
  maxTips: number;
  suggestFromNative: boolean;
}

const DEFAULTS: PhrasePatchOptions = {
  enabled: true,
  targetLanguage: "English",
  nativeLanguage: "Portuguese",
  mode: "light",
  maxTips: 2,
  suggestFromNative: true,
};

export function resolveOptions(input: Record<string, unknown>): PhrasePatchOptions {
  const mode = input.mode;
  const maxTips = input.maxTips;

  return {
    enabled: typeof input.enabled === "boolean" ? input.enabled : DEFAULTS.enabled,
    targetLanguage:
      typeof input.targetLanguage === "string" && input.targetLanguage.trim()
        ? input.targetLanguage.trim()
        : DEFAULTS.targetLanguage,
    nativeLanguage:
      typeof input.nativeLanguage === "string" && input.nativeLanguage.trim()
        ? input.nativeLanguage.trim()
        : DEFAULTS.nativeLanguage,
    mode: mode === "light" || mode === "normal" || mode === "study" ? mode : DEFAULTS.mode,
    maxTips:
      typeof maxTips === "number" && Number.isInteger(maxTips) && maxTips >= 1 && maxTips <= 5
        ? maxTips
        : DEFAULTS.maxTips,
    suggestFromNative:
      typeof input.suggestFromNative === "boolean"
        ? input.suggestFromNative
        : DEFAULTS.suggestFromNative,
  };
}
