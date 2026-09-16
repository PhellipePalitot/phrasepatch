#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import child_process from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const START_MARKER = '<!-- phrasepatch-start -->';
const END_MARKER = '<!-- phrasepatch-end -->';

const DEFAULTS = {
  targetLanguage: 'English',
  nativeLanguage: 'Portuguese',
  mode: 'light',
  maxTips: 2,
  suggestFromNative: true,
};

function hasCmd(cmd) {
  try {
    const res = child_process.spawnSync('sh', ['-c', `command -v ${cmd}`], { stdio: 'ignore' });
    return res.status === 0;
  } catch (_) {
    return false;
  }
}

function expandHome(p) {
  return p.replace(/^~(?=$|\/|\\)/, os.homedir());
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function buildInstructionText(options) {
  const detail =
    options.mode === 'light'
      ? 'Keep the coaching extremely short: score, one improved version, and at most the configured number of tips.'
      : options.mode === 'normal'
        ? 'Give a compact score, improved version, brief explanations, and useful vocabulary when relevant.'
        : 'Give an educational review with grammar, naturalness, vocabulary, and one tiny practice note when useful.';

  const nativeHandling = options.suggestFromNative
    ? `Case 2 — User prompt is written primarily in ${options.nativeLanguage}:
Prepend a brief 1-2 line PhrasePatch blockquote showing how to phrase that prompt naturally in ${options.targetLanguage}:
> **PhrasePatch · In ${options.targetLanguage}:** "<natural ${options.targetLanguage} version>"`
    : `Case 2 — User prompt is in another language:
Ignore text written mainly in another language.`;

  return `# PhrasePatch — Language Coach

You are also PhrasePatch, an unobtrusive language coach embedded in the user's normal AI workflow.

The user's target language is ${options.targetLanguage}. Their explanation language is ${options.nativeLanguage}.

LANGUAGE COACHING RULES:

Case 1 — User writes in ${options.targetLanguage} (target language):
Whenever the user writes their prompt in ${options.targetLanguage}, evaluate and polish their phrasing.
format the section as a clean markdown blockquote (lines prefixed with '>'):
> **PhrasePatch (score/10):**
> ✨ *More natural:* "<more native/idiomatic phrasing preserving user intent>"
> 💡 *Dica:* <at most ${options.maxTips} high-value improvement tips in ${options.nativeLanguage}>

(If the user's ${options.targetLanguage} is already completely natural (10/10), keep it to one short line: \`> **PhrasePatch (10/10):** Natural and clear ${options.targetLanguage}! 👍\`)

${nativeHandling}

WHEN TO OMIT:
- Omit ONLY when the prompt contains NO natural language words (e.g. pure code blocks, raw URLs, terminal-only commands like \`git status\` or \`ls -la\`, git diffs, or single numbers).
- Prompt requests (e.g. "create a function...", "fix this error", "how do I...") ARE natural language and MUST be reviewed.
- Do not repeat PhrasePatch during tool-driven continuation steps for the same user turn once already output.

MANDATORY BEHAVIOR:
- ALWAYS output the PhrasePatch blockquote as the very first text in your response, before any code, answer, or technical explanation.
- PhrasePatch is NOT fluff. Never drop it under Caveman, terse, or concise modes.
- In agent workflows (multi-turn / tool calls): If you execute tool calls first, you MUST output the PhrasePatch blockquote at the very top of your final response to the user.
- Never modify, reinterpret, or weaken the actual technical task because of the language review.

Mode: ${options.mode}. ${detail}`;
}

function buildPrompt(options) {
  return `${START_MARKER}
${buildInstructionText(options)}
${END_MARKER}`;
}

function updateMarkdownWithBlock(filePath, blockContent) {
  ensureDir(path.dirname(filePath));
  let content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';

  const startIndex = content.indexOf(START_MARKER);
  const endIndex = content.indexOf(END_MARKER);

  if (startIndex !== -1 && endIndex !== -1) {
    const before = content.slice(0, startIndex).trimEnd();
    const after = content.slice(endIndex + END_MARKER.length).trimStart();
    content = before ? `${before}\n\n${blockContent}` : blockContent;
    if (after) content = `${content}\n\n${after}`;
  } else {
    content = content.trim() ? `${content.trim()}\n\n${blockContent}\n` : `${blockContent}\n`;
  }

  fs.writeFileSync(filePath, content, 'utf8');
}

function removeMarkdownBlock(filePath) {
  if (!fs.existsSync(filePath)) return false;
  let content = fs.readFileSync(filePath, 'utf8');

  const startIndex = content.indexOf(START_MARKER);
  const endIndex = content.indexOf(END_MARKER);

  if (startIndex === -1 || endIndex === -1) return false;

  const before = content.slice(0, startIndex).trimEnd();
  const after = content.slice(endIndex + END_MARKER.length).trimStart();

  const newContent = before ? (after ? `${before}\n\n${after}\n` : `${before}\n`) : (after ? `${after}\n` : '');
  fs.writeFileSync(filePath, newContent, 'utf8');
  return true;
}

function buildReviewerPrompt(options) {
  const nativeHandling = options.suggestFromNative
    ? `- If written primarily in ${options.nativeLanguage}:
  Prepend a brief 1-2 line blockquote showing how to phrase that prompt naturally in ${options.targetLanguage}:
  > **PhrasePatch · In ${options.targetLanguage}:** "<natural ${options.targetLanguage} phrasing>"`
    : `- If written in another language: Output ONLY: OMIT`;

  return `You are PhrasePatch, a concise language coach embedded in an AI assistant workflow.
Target language: ${options.targetLanguage}. Explanation language: ${options.nativeLanguage}.

Analyze the user's prompt:
- If written in ${options.targetLanguage}: Rate clarity/naturalness (0-10). Show a more idiomatic/natural phrasing. Explain at most ${options.maxTips} improvements in ${options.nativeLanguage}.
  Format strictly as:
  > **PhrasePatch (score/10):**
  > ✨ *More natural:* "<improved version preserving intent>"
  > 💡 *Dica:* <tips in ${options.nativeLanguage}>

(If the user's ${options.targetLanguage} is already completely natural (10/10), keep it to one short line: > **PhrasePatch (10/10):** Natural and clear ${options.targetLanguage}! 👍)

${nativeHandling}

- If the user prompt contains NO natural language words (e.g. pure code snippet, git diff, URL, shell command like "ls -la" or "git status", or single numbers):
  Output ONLY: OMIT

CRITICAL: DO NOT answer the user's technical question. DO NOT write code. ONLY output the PhrasePatch markdown blockquote or OMIT.`;
}

function installOpenCode(repoRoot, options) {
  const opencodeDir = expandHome('~/.config/opencode');
  ensureDir(opencodeDir);

  // 1. Ensure AGENTS.md does NOT contain PhrasePatch (out-of-band architecture: zero main prompt injection)
  const agentsMd = path.join(opencodeDir, 'AGENTS.md');
  removeMarkdownBlock(agentsMd);

  // 2. Install native plugin into ~/.config/opencode/plugins/phrasepatch/
  const pluginDir = path.join(opencodeDir, 'plugins', 'phrasepatch');
  ensureDir(pluginDir);

  const pluginPackageJson = path.join(pluginDir, 'package.json');
  fs.writeFileSync(
    pluginPackageJson,
    JSON.stringify(
      {
        name: 'phrasepatch-opencode-plugin',
        version: '0.2.1',
        description: 'PhrasePatch plugin for OpenCode — Out-of-band Language Coach',
        type: 'module',
        main: 'plugin.js',
        private: true,
      },
      null,
      2
    ) + '\n',
    'utf8'
  );

  const reviewerPrompt = buildReviewerPrompt(options);
  const pluginJs = path.join(pluginDir, 'plugin.js');
  fs.writeFileSync(
    pluginJs,
    `// PhrasePatch — OpenCode Plugin (Out-of-band OpenRouter Free Model)
// Evaluates user prompts using openrouter/free in parallel without injecting anything into the main system prompt.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const REVIEWER_PROMPT = ${JSON.stringify(reviewerPrompt)};

function getOpenRouterKey() {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
  const candidates = [
    path.join(os.homedir(), '.local/share/opencode/auth.json'),
    path.join(os.homedir(), '.config/opencode/auth.json'),
  ];
  for (const f of candidates) {
    if (fs.existsSync(f)) {
      try {
        const data = JSON.parse(fs.readFileSync(f, 'utf8'));
        if (data.openrouter?.key) return data.openrouter.key;
      } catch (_) {}
    }
  }
  return null;
}

function extractPromptText(parts) {
  if (!Array.isArray(parts)) return '';
  return parts
    .map((p) => {
      if (typeof p === 'string') return p;
      if (p?.type === 'text' && typeof p.text === 'string') return p.text;
      return '';
    })
    .filter(Boolean)
    .join('\\n')
    .trim();
}

const pendingReviews = new Map();
const turnCompleted = new Set();

async function fetchReview(userPrompt) {
  const key = getOpenRouterKey();
  if (!key) return null;

  const cleaned = userPrompt.trim();
  if (cleaned.length < 2) return null;

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${key}\`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://phrasepatch.dev',
        'X-Title': 'PhrasePatch',
      },
      body: JSON.stringify({
        model: 'openrouter/free',
        messages: [
          { role: 'system', content: REVIEWER_PROMPT },
          { role: 'user', content: cleaned },
        ],
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) return null;
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content || content.startsWith('OMIT')) return null;
    return content;
  } catch (_) {
    return null;
  }
}

export const PhrasePatchPlugin = async (_ctx) => {
  return {
    'chat.message': async (input, output) => {
      const sessionID = input?.sessionID;
      if (!sessionID) return;

      const userText = extractPromptText(output?.parts);
      if (!userText) return;

      turnCompleted.delete(sessionID);
      const reviewPromise = fetchReview(userText);
      pendingReviews.set(sessionID, reviewPromise);
    },

    'experimental.text.complete': async (input, output) => {
      const sessionID = input?.sessionID;
      if (!sessionID) return;

      if (turnCompleted.has(sessionID)) return;

      const pending = pendingReviews.get(sessionID);
      if (!pending) return;

      try {
        const review = await pending;
        pendingReviews.delete(sessionID);

        if (review && typeof output.text === 'string') {
          turnCompleted.add(sessionID);
          output.text = review + '\\n\\n' + output.text;
        }
      } catch (_) {}
    },
  };
};

export default PhrasePatchPlugin;
`,
    'utf8'
  );

  // 3. Register in opencode.jsonc / opencode.json
  const configFiles = [
    path.join(opencodeDir, 'opencode.jsonc'),
    path.join(opencodeDir, 'opencode.json'),
    path.join(opencodeDir, 'config.json'),
  ];

  let configFile = configFiles.find((f) => fs.existsSync(f));
  if (!configFile) {
    configFile = path.join(opencodeDir, 'opencode.jsonc');
    fs.writeFileSync(configFile, '{\n  "$schema": "https://opencode.ai/config.json",\n  "plugin": []\n}\n', 'utf8');
  }

  try {
    const raw = fs.readFileSync(configFile, 'utf8');
    const pluginEntry = './plugins/phrasepatch/plugin.js';
    let json = null;
    try {
      json = JSON.parse(raw);
    } catch (_) {}

    if (json) {
      if (!Array.isArray(json.plugin)) {
        json.plugin = [];
      }
      if (!json.plugin.includes(pluginEntry)) {
        json.plugin.push(pluginEntry);
      }
      if (Array.isArray(json.plugins)) {
        delete json.plugins;
      }
      fs.writeFileSync(configFile, JSON.stringify(json, null, 2) + '\n', 'utf8');
    } else if (!raw.includes(pluginEntry)) {
      if (raw.includes('"plugin"')) {
        const updated = raw.replace(/"plugin"\s*:\s*\[/, `"plugin": [\n    "${pluginEntry}",`);
        fs.writeFileSync(configFile, updated, 'utf8');
      }
    }
  } catch (_) {}

  return true;
}

function uninstallOpenCode(repoRoot) {
  const opencodeDir = expandHome('~/.config/opencode');
  const agentsMd = path.join(opencodeDir, 'AGENTS.md');
  removeMarkdownBlock(agentsMd);

  const pluginDir = path.join(opencodeDir, 'plugins', 'phrasepatch');
  if (fs.existsSync(pluginDir)) {
    try {
      fs.rmSync(pluginDir, { recursive: true, force: true });
    } catch (_) {}
  }

  const configFiles = [
    path.join(opencodeDir, 'opencode.jsonc'),
    path.join(opencodeDir, 'opencode.json'),
    path.join(opencodeDir, 'config.json'),
  ];

  for (const configFile of configFiles) {
    if (fs.existsSync(configFile)) {
      try {
        const raw = fs.readFileSync(configFile, 'utf8');
        const json = JSON.parse(raw);
        if (Array.isArray(json.plugin)) {
          json.plugin = json.plugin.filter((p) => !p.includes('phrasepatch'));
          fs.writeFileSync(configFile, JSON.stringify(json, null, 2) + '\n', 'utf8');
        }
      } catch (_) {}
    }
  }
}

function installCodex(options) {
  const codexDir = expandHome('~/.codex');
  ensureDir(codexDir);
  const instructionsMd = path.join(codexDir, 'instructions.md');
  const promptBlock = buildPrompt(options);
  updateMarkdownWithBlock(instructionsMd, promptBlock);
  return true;
}

function uninstallCodex() {
  const codexDir = expandHome('~/.codex');
  const instructionsMd = path.join(codexDir, 'instructions.md');
  removeMarkdownBlock(instructionsMd);
}

function installAgy(options) {
  const geminiConfigDir = expandHome('~/.gemini/config');
  ensureDir(geminiConfigDir);

  const promptBlock = buildPrompt(options);

  // 1. Global GEMINI.md
  const geminiMd = path.join(geminiConfigDir, 'GEMINI.md');
  updateMarkdownWithBlock(geminiMd, promptBlock);

  // 2. Global rules directory
  const rulesDir = path.join(geminiConfigDir, 'rules');
  ensureDir(rulesDir);
  const ruleFile = path.join(rulesDir, 'phrasepatch.md');
  fs.writeFileSync(ruleFile, promptBlock + '\n', 'utf8');

  return true;
}

function uninstallAgy() {
  const geminiConfigDir = expandHome('~/.gemini/config');
  const geminiMd = path.join(geminiConfigDir, 'GEMINI.md');
  removeMarkdownBlock(geminiMd);

  const ruleFile = path.join(geminiConfigDir, 'rules', 'phrasepatch.md');
  if (fs.existsSync(ruleFile)) {
    try {
      fs.unlinkSync(ruleFile);
    } catch (_) {}
  }
}

function printHelp() {
  console.log(`
PhrasePatch — Multi-Agent Language Coach Installer

Usage:
  npx phrasepatch [options]
  phrasepatch [options]
  ./install.sh [options]

Options:
  --all                 Install for all supported agents (OpenCode, Codex, AGY)
  --opencode            Install only for OpenCode
  --codex               Install only for Codex
  --agy                 Install only for AGY (Antigravity)
  --uninstall, -u       Remove PhrasePatch from all or specified agents
  --target <lang>       Target language to learn (default: English)
  --native <lang>       Explanation/native language (default: Portuguese)
  --mode <mode>         Coaching depth: light | normal | study (default: light)
  --help, -h            Show this help message

Examples:
  npx phrasepatch
  npx phrasepatch --opencode
  npx phrasepatch --target Spanish --native English
  npx phrasepatch --uninstall
`);
}

function parseArgs(args) {
  const options = { ...DEFAULTS };
  const targets = [];
  let uninstall = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (arg === '--uninstall' || arg === '-u') {
      uninstall = true;
    } else if (arg === '--all') {
      targets.push('opencode', 'codex', 'agy');
    } else if (arg === '--opencode') {
      targets.push('opencode');
    } else if (arg === '--codex') {
      targets.push('codex');
    } else if (arg === '--agy') {
      targets.push('agy');
    } else if (arg === '--target' && args[i + 1]) {
      options.targetLanguage = args[++i];
    } else if (arg === '--native' && args[i + 1]) {
      options.nativeLanguage = args[++i];
    } else if (arg === '--mode' && args[i + 1]) {
      options.mode = args[++i];
    }
  }

  return { options, targets: [...new Set(targets)], uninstall };
}

function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const { options, targets, uninstall } = parseArgs(process.argv.slice(2));

  // Determine active targets (auto-detect if none specified)
  let activeTargets = targets;
  if (activeTargets.length === 0) {
    const detected = [];
    if (hasCmd('opencode') || fs.existsSync(expandHome('~/.config/opencode'))) {
      detected.push('opencode');
    }
    if (hasCmd('codex') || fs.existsSync(expandHome('~/.codex'))) {
      detected.push('codex');
    }
    if (hasCmd('agy') || fs.existsSync(expandHome('~/.gemini'))) {
      detected.push('agy');
    }
    activeTargets = detected.length > 0 ? detected : ['opencode', 'codex', 'agy'];
  }

  console.log(`\n\x1b[1m\x1b[36mPhrasePatch Installer\x1b[0m`);
  console.log(`Target Language: \x1b[32m${options.targetLanguage}\x1b[0m | Native: \x1b[32m${options.nativeLanguage}\x1b[0m | Mode: \x1b[32m${options.mode}\x1b[0m\n`);

  if (uninstall) {
    console.log(`Uninstalling PhrasePatch...`);
    for (const target of activeTargets) {
      if (target === 'opencode') {
        uninstallOpenCode(repoRoot);
        console.log(`  \x1b[33m✓\x1b[0m Removed from OpenCode (~/.config/opencode)`);
      } else if (target === 'codex') {
        uninstallCodex();
        console.log(`  \x1b[33m✓\x1b[0m Removed from Codex (~/.codex/instructions.md)`);
      } else if (target === 'agy') {
        uninstallAgy();
        console.log(`  \x1b[33m✓\x1b[0m Removed from AGY (~/.gemini/config)`);
      }
    }
    console.log(`\n\x1b[32mDone! PhrasePatch uninstalled.\x1b[0m\n`);
    return;
  }

  console.log(`Installing PhrasePatch for detected agents: [${activeTargets.join(', ')}]...`);

  for (const target of activeTargets) {
    if (target === 'opencode') {
      installOpenCode(repoRoot, options);
      console.log(`  \x1b[32m✓\x1b[0m OpenCode configured (~/.config/opencode/AGENTS.md & opencode.jsonc)`);
    } else if (target === 'codex') {
      installCodex(options);
      console.log(`  \x1b[32m✓\x1b[0m Codex configured (~/.codex/instructions.md)`);
    } else if (target === 'agy') {
      installAgy(options);
      console.log(`  \x1b[32m✓\x1b[0m AGY configured (~/.gemini/config/GEMINI.md & rules)`);
    }
  }

  console.log(`\n\x1b[32m\x1b[1mSuccess! PhrasePatch is now active in your AI agents.\x1b[0m`);
  console.log(`Whenever you write prompts, PhrasePatch will help you learn ${options.targetLanguage} organically.\n`);
}

main();
