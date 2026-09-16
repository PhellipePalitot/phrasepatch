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
        : 'Give a compact but educational review with grammar, naturalness, vocabulary, and one tiny practice note when useful.';

  const nativeHandling = options.suggestFromNative
    ? `If the user message is written primarily in ${options.nativeLanguage}, answer the technical task normally, but prepend a brief 1-2 line PhrasePatch blockquote showing how to phrase that prompt naturally in ${options.targetLanguage} (e.g. '> **PhrasePatch · In ${options.targetLanguage}:** "..."').`
    : 'Ignore text written mainly in another language.';

  return `# PhrasePatch — Language Coach

You are also PhrasePatch, an unobtrusive language coach embedded in the user's normal AI workflow.

The user's target language is ${options.targetLanguage}. Their explanation language is ${options.nativeLanguage}.

For the latest user-authored request, silently decide whether there is enough natural-language text to review. Ignore code, logs, paths, identifiers, commands, stack traces, and quoted source material. ${nativeHandling}

When review is useful, begin the assistant response with a small section titled "PhrasePatch" and then continue with the user's actual task normally.

The PhrasePatch section should:
- rate clarity/naturalness on a 0-10 scale without being harsh;
- show one more natural version that preserves the user's exact intent;
- explain at most ${options.maxTips} high-value improvements in ${options.nativeLanguage};
- prioritize expressions the user can reuse in real work;
- format the section as a clean markdown blockquote (lines prefixed with '>') or a clearly delimited block followed by '---', keeping it visually distinct from the main technical response;
- never turn the interaction into a long grammar lesson unless mode is study;
- praise nothing mechanically; if the sentence is already natural, keep the section to one short line or omit it;
- never modify, reinterpret, or weaken the actual task because of the language review;
- always output this section when applicable, even in terse, concise, or caveman modes (do not drop it as fluff).

Do not repeat PhrasePatch feedback during tool-driven continuations for the same user request. If the visible conversation already contains a PhrasePatch section for the latest user message, omit it.

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

function installOpenCode(repoRoot, options) {
  const opencodeDir = expandHome('~/.config/opencode');
  ensureDir(opencodeDir);

  // 1. Install via AGENTS.md (loaded globally by OpenCode in all sessions)
  const agentsMd = path.join(opencodeDir, 'AGENTS.md');
  const promptBlock = buildPrompt(options);
  updateMarkdownWithBlock(agentsMd, promptBlock);

  // 2. Install native plugin into ~/.config/opencode/plugins/phrasepatch/
  const pluginDir = path.join(opencodeDir, 'plugins', 'phrasepatch');
  ensureDir(pluginDir);

  const pluginPackageJson = path.join(pluginDir, 'package.json');
  fs.writeFileSync(
    pluginPackageJson,
    JSON.stringify(
      {
        name: 'phrasepatch-opencode-plugin',
        version: '0.1.0',
        description: 'PhrasePatch plugin for OpenCode — Language Coach',
        type: 'module',
        main: 'plugin.js',
        private: true,
      },
      null,
      2
    ) + '\n',
    'utf8'
  );

  const instructionText = buildInstructionText(options);
  const pluginJs = path.join(pluginDir, 'plugin.js');
  fs.writeFileSync(
    pluginJs,
    `// PhrasePatch — OpenCode plugin
// Injects language coaching instructions into OpenCode's system prompt.

const COACH_INSTRUCTION = ${JSON.stringify(instructionText)};

export const PhrasePatchPlugin = async (_ctx) => {
  return {
    'experimental.chat.system.transform': async (_input, output) => {
      if (!output || !Array.isArray(output.system)) return;
      const alreadyInjected = output.system.some(
        (s) => typeof s === 'string' && s.includes('PhrasePatch')
      );
      if (alreadyInjected) return;
      if (output.system.length > 0) {
        output.system[output.system.length - 1] += '\\n\\n' + COACH_INSTRUCTION;
      } else {
        output.system.push(COACH_INSTRUCTION);
      }
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
