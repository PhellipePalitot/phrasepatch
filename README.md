# PhrasePatch

**Learn a language from the things you already write.**

PhrasePatch is an unobtrusive language coach for AI-assisted workflows. Instead of asking you to stop working and open a language course, it turns the prompts you already write into small, contextual learning moments.

The first integration targets **OpenCode V2**.

## The idea

You write your normal prompt:

```text
create a endpoint for get all users with pagination
```

PhrasePatch asks the same model to begin with a tiny language review:

```text
> PhrasePatch · 7/10
> 
> More natural:
> Create an endpoint to retrieve all users with pagination.
> 
> Learn:
> - Use "an endpoint", not "a endpoint".
> - "to retrieve" is more natural than "for get".

[normal agent response continues here...]
```

Or when prompting in your native language:

```text
crie um endpoint para listar todos os usuários com paginação
```

```text
> PhrasePatch · In English:
> "Create an endpoint to retrieve all users with pagination."

[normal agent response continues here...]
```

PhrasePatch never replaces the user's prompt. It adds temporary coaching instructions to the outgoing model context, leaving the persisted user request intact.

## Why PhrasePatch?

Traditional language apps separate study from work. PhrasePatch uses the language you actually need in the context where you actually need it.

The target language is configurable. English is only the default.

## Status

`v0.1.0` — early prototype.

Current scope:

- OpenCode V2 plugin
- configurable target language
- configurable explanation/native language
- light, normal, and study modes
- target language suggestions from native prompts (`suggestFromNative`)
- no second LLM call
- no prompt rewriting

Planned:

- language detection
- local model / Ollama reviewer
- persistent learning history
- recurring mistake detection
- spaced repetition
- CLI
- MCP server
- Codex and Claude Code integrations

## Requirements

- OpenCode V2
- Node.js 20+ (Node.js 22 recommended for development)

PhrasePatch uses the current OpenCode V2 plugin API through `@opencode/plugin`.

## Local development

```bash
git clone https://github.com/YOUR_USER/phrasepatch.git
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

```text
User prompt
    │
    ▼
OpenCode
    │
    ├── PhrasePatch context hook
    │       └── temporary coaching instruction
    │
    ▼
Selected model
    │
    ├── tiny PhrasePatch review
    └── normal task response
```

The first release intentionally reuses the selected model. A dedicated reviewer backend (including Ollama) can be introduced later without changing the product UX.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
