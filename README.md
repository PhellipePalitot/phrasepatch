# PhrasePatch

**Learn a language from the things you already write.**

PhrasePatch is an unobtrusive language coach for AI-assisted workflows. Instead of asking you to stop working and open a language course, it turns the prompts you already write into small, contextual learning moments.

It works with **OpenCode**, **Codex**, and **AGY (Antigravity)**.

## The idea

You write your normal prompt:

```text
create a endpoint for get all users with pagination
```

PhrasePatch provides a tiny language review at the top of the response:

```markdown
> **PhrasePatch (7/10):**
> ✨ *More natural:* "Create an endpoint to retrieve all users with pagination."
> 💡 *Dica:* Use "an endpoint", not "a endpoint"; "to retrieve" is more natural than "for get".

[normal agent response continues here...]
```

Or when prompting in your native language:

```text
crie um endpoint para listar todos os usuários com paginação
```

```markdown
> **PhrasePatch · In English:** "Create an endpoint to retrieve all users with pagination."

[normal agent response continues here...]
```

PhrasePatch never alters your prompt's intent. In OpenCode, it evaluates prompts out-of-band using OpenRouter's free router (`openrouter/free`), keeping the main session prompt 100% clean and free of token pollution.

## Why PhrasePatch?

Traditional language apps separate study from work. PhrasePatch uses the language you actually need in the context where you actually need it.

The target language is configurable. English is only the default.

## Status

`v0.2.1` — stable multi-agent coach.

Current features:

- **OpenCode plugin**: Out-of-band parallel review via OpenRouter's free tier (`openrouter/free`) — zero system prompt pollution, zero extra token cost, fully compatible with terse/caveman modes.
- **Codex & AGY integrations**: Clean prompt rules injected directly into instruction files (`instructions.md` / `rules`).
- **Configurable target language**: Default is English.
- **Configurable explanation language**: Default is Portuguese.
- **Modes**: `light`, `normal`, and `study`.
- **Native prompt translations**: (`suggestFromNative`) converts Portuguese prompts into natural English equivalents.
- **Smart omission**: Pure code snippets, raw URLs, and terminal commands (e.g. `git status`, `ls`) are automatically omitted.
- **Unified installer**: One command to install or uninstall across OpenCode, Codex, and AGY.

Planned:

- language auto-detection
- local model / Ollama reviewer backend
- persistent learning history & recurring mistake tracker
- spaced repetition review mode
- dedicated Claude Code and Cursor hooks

## Quick Install

Install PhrasePatch automatically into your local coding agents (**OpenCode**, **Codex**, and **AGY / Antigravity**):

```bash
# Using npx (zero setup):
npx phrasepatch

# Or from local clone:
./install.sh
```

Target specific agents:

```bash
npx phrasepatch --opencode   # Configure OpenCode (~/.config/opencode)
npx phrasepatch --codex      # Configure Codex (~/.codex/instructions.md)
npx phrasepatch --agy        # Configure AGY (~/.gemini/config/GEMINI.md)
```

Customize languages and coaching mode:

```bash
npx phrasepatch --target English --native Portuguese --mode light
```

To remove PhrasePatch at any time:

```bash
npx phrasepatch --uninstall
```

## Local development

```bash
git clone https://github.com/PhellipePalitot/phrasepatch.git
cd phrasepatch
npm install
npm run check
```

To test the plugin from a local checkout, reference its directory from your OpenCode config:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    {
      "package": "/absolute/path/to/phrasepatch",
      "options": {
        "targetLanguage": "English",
        "nativeLanguage": "Portuguese",
        "mode": "light"
      }
    }
  ]
}
```

OpenCode V2 supports local paths, Git repositories, and npm packages as plugin sources.

## Configuration

```jsonc
{
  "plugins": [
    {
      "package": "phrasepatch",
      "options": {
        "enabled": true,
        "targetLanguage": "English",
        "nativeLanguage": "Portuguese",
        "mode": "light",
        "maxTips": 2,
        "suggestFromNative": true
      }
    }
  ]
}
```

### Options

- `enabled` (`boolean`, default: `true`): Enable or disable PhrasePatch.
- `targetLanguage` (`string`, default: `"English"`): Language you want to practice.
- `nativeLanguage` (`string`, default: `"Portuguese"`): Language used for feedback and tips.
- `mode` (`"light"` | `"normal"` | `"study"`, default: `"light"`): Coaching depth.
- `maxTips` (`number`, 1–5, default: `2`): Maximum number of actionable tips per response.
- `suggestFromNative` (`boolean`, default: `true`): When you write prompts in your native language, provides a compact note on how to phrase it in your target language.

### Modes

- `light`: tiny feedback designed for everyday use.
- `normal`: short explanations and useful vocabulary.
- `study`: more educational feedback while keeping the original task first-class.

## Design principles

1. **Work first.** PhrasePatch must not get in the way of the user's task.
2. **Never silently rewrite intent.** The original prompt stays intact.
3. **Small feedback beats lectures.** Everyday repetition is the learning mechanism.
4. **Any language.** English is a configuration, not the product identity.
5. **Privacy-friendly by design.** A future local-model mode should allow coaching without sending prompts to an additional provider.

## Architecture

### 1. OpenCode (Out-of-band Parallel Review)

In OpenCode, PhrasePatch runs as a native plugin that evaluates prompts asynchronously in parallel via OpenRouter's free router (`openrouter/free`):

```text
User prompt
    │
    ├──► OpenCode Main Agent ────► Code Generation / Tools (clean context, zero prompt pollution)
    │                                    │
    └──► OpenRouter (openrouter/free)    │
             │                           │
             ▼                           ▼
       Language review ─────────► Prepend to final output
```

- **Zero prompt pollution:** The main coding model's system prompt is untouched.
- **Full compatibility:** Works seamlessly alongside brevity plugins (like Caveman mode) and multi-step tool loops.
- **Zero additional cost:** Uses the `openrouter/free` router endpoint with your existing OpenRouter key.

### 2. Codex & AGY (Antigravity)

In Codex and AGY, PhrasePatch installs concise, unobtrusive coaching instructions directly into the agent's system rule files (`~/.codex/instructions.md` and `~/.gemini/config/rules/phrasepatch.md`).

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
