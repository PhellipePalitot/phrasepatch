import { Plugin } from "@opencode/plugin";
import { buildCoachInstruction, buildReviewerSystemPrompt } from "./instructions";
import { resolveOptions } from "./options";

export default Plugin.define({
  id: "phrasepatch",

  async setup(ctx) {
    const options = resolveOptions(ctx.options as Record<string, unknown>);

    if (!options.enabled) return;

    await ctx.session.hook("context", (event) => {
      event.system.push({
        type: "text",
        text: buildCoachInstruction(options),
      });
    });
  },
});

export { buildCoachInstruction, buildReviewerSystemPrompt, resolveOptions };
export type { PhrasePatchMode, PhrasePatchOptions } from "./options";
