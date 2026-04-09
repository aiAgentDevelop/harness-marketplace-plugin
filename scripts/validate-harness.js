/**
 * validate-harness.js
 *
 * Structure and schema validation for generated project-harness.
 * Run via Chrome DevTools MCP's evaluate_script or directly with Node.js.
 *
 * Usage: node scripts/validate-harness.js [project-path]
 * Default project-path: current working directory
 */

const fs = require('fs');
const path = require('path');
const yaml = require ? require('yaml') : null;

const HARNESS_ROOT = '.claude/skills/project-harness';

const REQUIRED_FILES = [
  'SKILL.md',
  'project-config.yaml',
  'plan/SKILL.md',
  'implement/SKILL.md',
  'verify/SKILL.md',
  'references/classification.md',
  'references/schemas.md',
];

const CONDITIONAL_FILES = {
  'visual-qa/SKILL.md': 'has_ui',
  'visual-qa/scripts/visual-inspect.js': 'has_ui',
};

const REQUIRED_CONFIG_FIELDS = [
  'version',
  'generated_by',
  'language',
  'project_type',
  'project_type.category',
  'project_type.subcategory',
  'project_type.purpose',
  'platform',
  'serverless',
  'tech_stack',
  'flags',
  'agents',
  'guides',
  'commands',
];

const REQUIRED_FLAGS = [
  'has_ui',
  'has_backend',
  'has_database',
  'has_cache',
  'has_auth',
  'has_realtime',
  'visual_qa_capable',
];

const VALID_CATEGORIES = [
  'web', 'mobile', 'backend', 'desktop',
  'game', 'cli', 'data', 'iot',
];

function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

function validateStructure(projectPath) {
  const harnessPath = path.join(projectPath, HARNESS_ROOT);
  const errors = [];
  const warnings = [];

  // Check harness directory exists
  if (!fs.existsSync(harnessPath)) {
    errors.push(`Harness directory not found: ${harnessPath}`);
    return { valid: false, errors, warnings, checks: 0, passed: 0 };
  }

  let checks = 0;
  let passed = 0;

  // Check required files
  for (const file of REQUIRED_FILES) {
    checks++;
    const filePath = path.join(harnessPath, file);
    if (fs.existsSync(filePath)) {
      passed++;
    } else {
      errors.push(`Missing required file: ${file}`);
    }
  }

  // Check agents directory has at least one file
  checks++;
  const agentsPath = path.join(harnessPath, 'agents');
  if (fs.existsSync(agentsPath)) {
    const agentFiles = fs.readdirSync(agentsPath).filter(f => f.endsWith('.md'));
    if (agentFiles.length > 0) {
      passed++;
    } else {
      errors.push('agents/ directory exists but contains no .md files');
    }
  } else {
    errors.push('Missing agents/ directory');
  }

  // Check guides directory has at least one file
  checks++;
  const guidesPath = path.join(harnessPath, 'guides');
  if (fs.existsSync(guidesPath)) {
    const guideFiles = fs.readdirSync(guidesPath).filter(f => f.endsWith('.md'));
    if (guideFiles.length > 0) {
      passed++;
    } else {
      errors.push('guides/ directory exists but contains no .md files');
    }
  } else {
    errors.push('Missing guides/ directory');
  }

  // Check state directory
  checks++;
  const statePath = path.join(harnessPath, 'state');
  if (fs.existsSync(statePath)) {
    passed++;
  } else {
    warnings.push('state/ directory not found (will be created at runtime)');
    passed++; // Non-blocking
  }

  return { valid: errors.length === 0, errors, warnings, checks, passed };
}

function validateConfig(projectPath) {
  const configPath = path.join(projectPath, HARNESS_ROOT, 'project-config.yaml');
  const errors = [];
  const warnings = [];
  let checks = 0;
  let passed = 0;

  if (!fs.existsSync(configPath)) {
    errors.push('project-config.yaml not found');
    return { valid: false, errors, warnings, checks: 1, passed: 0 };
  }

  // Parse YAML
  let config;
  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    // Simple YAML parsing (key: value) if yaml module not available
    if (yaml) {
      config = yaml.parse(content);
    } else {
      // Fallback: try JSON parse or basic YAML
      try {
        config = JSON.parse(content);
      } catch {
        errors.push('Cannot parse project-config.yaml (install yaml package for full validation)');
        return { valid: false, errors, warnings, checks: 1, passed: 0 };
      }
    }
    checks++;
    passed++;
  } catch (e) {
    errors.push(`Failed to parse project-config.yaml: ${e.message}`);
    return { valid: false, errors, warnings, checks: 1, passed: 0 };
  }

  // Check required fields
  for (const field of REQUIRED_CONFIG_FIELDS) {
    checks++;
    const value = getNestedValue(config, field);
    if (value !== undefined && value !== null) {
      passed++;
    } else {
      errors.push(`Missing required config field: ${field}`);
    }
  }

  // Validate category
  checks++;
  if (config.project_type && VALID_CATEGORIES.includes(config.project_type.category)) {
    passed++;
  } else {
    errors.push(`Invalid project category: ${config.project_type?.category}. Must be one of: ${VALID_CATEGORIES.join(', ')}`);
  }

  // Check flags
  if (config.flags) {
    for (const flag of REQUIRED_FLAGS) {
      checks++;
      if (typeof config.flags[flag] === 'boolean') {
        passed++;
      } else {
        errors.push(`Missing or non-boolean flag: flags.${flag}`);
      }
    }
  } else {
    checks += REQUIRED_FLAGS.length;
    errors.push('Missing flags section in config');
  }

  // Validate flag consistency with platform config
  if (config.flags && config.platform) {
    checks++;
    const expectedHasUi = config.platform.frontend?.framework !== 'none' && config.platform.frontend?.framework !== undefined;
    if (config.flags.has_ui === expectedHasUi || !config.platform.frontend) {
      passed++;
    } else {
      warnings.push(`Flag has_ui=${config.flags.has_ui} may not match frontend config (framework=${config.platform.frontend?.framework})`);
      passed++; // Warning, not error
    }

    checks++;
    const expectedHasBackend = config.platform.backend?.framework !== 'none' && config.platform.backend?.framework !== undefined;
    if (config.flags.has_backend === expectedHasBackend || !config.platform.backend) {
      passed++;
    } else {
      warnings.push(`Flag has_backend=${config.flags.has_backend} may not match backend config (framework=${config.platform.backend?.framework})`);
      passed++;
    }
  }

  // Check conditional files based on flags
  if (config.flags) {
    for (const [file, flag] of Object.entries(CONDITIONAL_FILES)) {
      if (config.flags[flag]) {
        checks++;
        const filePath = path.join(projectPath, HARNESS_ROOT, file);
        if (fs.existsSync(filePath)) {
          passed++;
        } else {
          errors.push(`Flag ${flag}=true but conditional file missing: ${file}`);
        }
      }
    }
  }

  // Check agents match config
  if (config.agents && Array.isArray(config.agents)) {
    const agentsPath = path.join(projectPath, HARNESS_ROOT, 'agents');
    if (fs.existsSync(agentsPath)) {
      for (const agent of config.agents) {
        checks++;
        const agentFile = path.join(agentsPath, `${agent}.md`);
        if (fs.existsSync(agentFile)) {
          passed++;
        } else {
          errors.push(`Agent listed in config but file missing: agents/${agent}.md`);
        }
      }
    }
  }

  // Check guides match config
  if (config.guides && Array.isArray(config.guides)) {
    const guidesPath = path.join(projectPath, HARNESS_ROOT, 'guides');
    if (fs.existsSync(guidesPath)) {
      for (const guide of config.guides) {
        checks++;
        const guideFile = path.join(guidesPath, `${guide}.md`);
        if (fs.existsSync(guideFile)) {
          passed++;
        } else {
          errors.push(`Guide listed in config but file missing: guides/${guide}.md`);
        }
      }
    }
  }

  // Check commands
  if (config.commands) {
    const requiredCommands = ['dev', 'build'];
    for (const cmd of requiredCommands) {
      checks++;
      if (config.commands[cmd]) {
        passed++;
      } else {
        warnings.push(`Recommended command missing: commands.${cmd}`);
        passed++; // Warning only
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings, checks, passed };
}

function validateSkillContent(projectPath) {
  const harnessPath = path.join(projectPath, HARNESS_ROOT);
  const errors = [];
  const warnings = [];
  let checks = 0;
  let passed = 0;

  const skillFiles = [
    'SKILL.md',
    'plan/SKILL.md',
    'implement/SKILL.md',
    'verify/SKILL.md',
  ];

  for (const file of skillFiles) {
    const filePath = path.join(harnessPath, file);
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, 'utf-8');

    // Check frontmatter exists
    checks++;
    if (content.startsWith('---')) {
      passed++;
    } else {
      errors.push(`${file}: Missing YAML frontmatter (must start with ---)`);
    }

    // Check no unresolved template variables
    checks++;
    const templateVarPattern = /\{\{[A-Z_]+(?::[a-z_]+)?\}\}/g;
    const unresolvedVars = content.match(templateVarPattern);
    if (!unresolvedVars) {
      passed++;
    } else {
      errors.push(`${file}: Unresolved template variables found: ${unresolvedVars.join(', ')}`);
    }

    // Check minimum content length (skills should have substantial content)
    checks++;
    if (content.length > 500) {
      passed++;
    } else {
      warnings.push(`${file}: Content seems too short (${content.length} chars)`);
      passed++;
    }

    // Check has Steps section
    checks++;
    if (content.includes('<Steps>') || content.includes('## Steps') || content.includes('## Phase')) {
      passed++;
    } else {
      warnings.push(`${file}: No Steps/Phase section found`);
      passed++;
    }
  }

  return { valid: errors.length === 0, errors, warnings, checks, passed };
}

function runValidation(projectPath) {
  console.log('=== Project Harness Validation ===\n');
  console.log(`Project: ${projectPath}`);
  console.log(`Harness: ${path.join(projectPath, HARNESS_ROOT)}\n`);

  const results = {
    structure: validateStructure(projectPath),
    config: validateConfig(projectPath),
    content: validateSkillContent(projectPath),
  };

  let totalChecks = 0;
  let totalPassed = 0;
  let totalErrors = [];
  let totalWarnings = [];

  for (const [section, result] of Object.entries(results)) {
    const icon = result.valid ? 'PASS' : 'FAIL';
    console.log(`[${icon}] ${section}: ${result.passed}/${result.checks} checks passed`);

    if (result.errors.length > 0) {
      for (const err of result.errors) {
        console.log(`  ERROR: ${err}`);
      }
    }
    if (result.warnings.length > 0) {
      for (const warn of result.warnings) {
        console.log(`  WARN: ${warn}`);
      }
    }

    totalChecks += result.checks;
    totalPassed += result.passed;
    totalErrors.push(...result.errors);
    totalWarnings.push(...result.warnings);
  }

  const allValid = totalErrors.length === 0;

  console.log('\n--- Summary ---');
  console.log(`Total: ${totalPassed}/${totalChecks} checks passed`);
  console.log(`Errors: ${totalErrors.length}`);
  console.log(`Warnings: ${totalWarnings.length}`);
  console.log(`Result: ${allValid ? 'VALID' : 'INVALID'}`);

  return {
    valid: allValid,
    checks: totalChecks,
    passed: totalPassed,
    errors: totalErrors,
    warnings: totalWarnings,
  };
}

// CLI execution
if (typeof require !== 'undefined' && require.main === module) {
  const projectPath = process.argv[2] || process.cwd();
  const result = runValidation(projectPath);
  process.exit(result.valid ? 0 : 1);
}

// Export for programmatic use
if (typeof module !== 'undefined') {
  module.exports = { runValidation, validateStructure, validateConfig, validateSkillContent };
}
