/**
 * merge-hooks.js
 *
 * Non-destructively merges generated hooks-config.json into .claude/settings.json.
 * Preserves existing user hooks and settings. Creates backup before merge.
 *
 * Usage: node scripts/merge-hooks.js [project-path]
 * Default project-path: current working directory
 */

const fs = require('fs');
const path = require('path');

const HARNESS_ROOT = '.claude/skills/project-harness';
const SETTINGS_PATH = '.claude/settings.json';
const HOOKS_CONFIG = 'hooks-config.json';

function main() {
  const projectPath = process.argv[2] || process.cwd();
  const settingsFile = path.join(projectPath, SETTINGS_PATH);
  const hooksConfigFile = path.join(projectPath, HARNESS_ROOT, HOOKS_CONFIG);

  // 1. Read hooks-config.json
  if (!fs.existsSync(hooksConfigFile)) {
    console.error(`[ERROR] hooks-config.json not found at: ${hooksConfigFile}`);
    process.exit(1);
  }

  let hooksConfig;
  try {
    hooksConfig = JSON.parse(fs.readFileSync(hooksConfigFile, 'utf-8'));
  } catch (e) {
    console.error(`[ERROR] Invalid JSON in hooks-config.json: ${e.message}`);
    process.exit(1);
  }

  if (!hooksConfig.hooks) {
    console.error('[ERROR] hooks-config.json missing "hooks" key');
    process.exit(1);
  }

  // 2. Read existing settings.json (or create empty)
  let settings = {};
  if (fs.existsSync(settingsFile)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
    } catch (e) {
      console.error(`[ERROR] Invalid JSON in settings.json: ${e.message}`);
      process.exit(1);
    }

    // 3. Create backup
    const backupFile = settingsFile + `.backup-${Date.now()}`;
    fs.copyFileSync(settingsFile, backupFile);
    console.log(`[BACKUP] ${backupFile}`);
  }

  // 4. Merge hooks
  if (!settings.hooks) {
    settings.hooks = {};
  }

  const HARNESS_MARKER = 'project-harness';
  let addedCount = 0;
  let skippedCount = 0;

  for (const [event, entries] of Object.entries(hooksConfig.hooks)) {
    if (!Array.isArray(entries)) continue;

    if (!settings.hooks[event]) {
      settings.hooks[event] = [];
    }

    for (const newEntry of entries) {
      // Check if this harness hook already exists (by command path)
      const isDuplicate = settings.hooks[event].some((existing) => {
        if (!existing.hooks || !Array.isArray(existing.hooks)) return false;
        return existing.hooks.some((h) => {
          if (!h.command) return false;
          return h.command.includes(HARNESS_MARKER);
        });
      });

      if (isDuplicate) {
        // Replace existing harness hook entry
        const idx = settings.hooks[event].findIndex((existing) => {
          if (!existing.hooks || !Array.isArray(existing.hooks)) return false;
          return existing.hooks.some((h) => h.command && h.command.includes(HARNESS_MARKER));
        });
        if (idx !== -1) {
          settings.hooks[event][idx] = newEntry;
          skippedCount++;
        }
      } else {
        settings.hooks[event].push(newEntry);
        addedCount++;
      }
    }
  }

  // 5. Write merged settings.json
  const dir = path.dirname(settingsFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + '\n', 'utf-8');

  console.log(`[MERGE] settings.json updated`);
  console.log(`  Added: ${addedCount} hook entries`);
  console.log(`  Updated: ${skippedCount} existing harness hooks`);
  console.log(`  Total hook events: ${Object.keys(settings.hooks).length}`);

  // 6. Print summary
  for (const [event, entries] of Object.entries(settings.hooks)) {
    console.log(`  ${event}: ${entries.length} entries`);
  }
}

main();
