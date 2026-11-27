import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const packsDir = path.join(rootDir, 'packs');

const WEAK_PASSWORD_VALUES = new Set([
  'password',
  '123456',
  '12345678',
  'admin',
  'root',
  'changeme',
  'secret',
  'qwerty',
  'postgres',
  'mysql',
  'test',
]);

/**
 * Validate a single docker-compose YAML string for security invariants.
 * Returns an array of violation strings (empty = valid).
 */
export function validateComposeContent(content, filePath, options = {}) {
  const { requireHealthcheck = false } = options;
  const violations = [];
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // 1. Block privileged: true
    if (/^privileged\s*:\s*true\b/i.test(trimmed)) {
      violations.push(`${filePath}:${i + 1}: privileged: true is forbidden`);
    }

    // 2. Block host root mounts (e.g. - /:/host or - /:/mnt:ro or source: /)
    if (/^-\s*["']?\/:[^/\s]/.test(trimmed) || /^-\s*["']?\/:\/.*/.test(trimmed)) {
      violations.push(`${filePath}:${i + 1}: host root mount (/:...) is forbidden`);
    }
    if (/^source\s*:\s*["']?\/["']?$/.test(trimmed)) {
      violations.push(`${filePath}:${i + 1}: host root bind source '/' is forbidden`);
    }

    // 3. Block hardcoded weak passwords (ignoring env interpolation ${...} and {{...}})
    const kvMatch = trimmed.match(/^(?:-\s*)?([A-Z0-9_]*(?:PASSWORD|PASSWD|SECRET)[A-Z0-9_]*)\s*[:=]\s*["']?([^"'\s#]+)["']?/i);
    if (kvMatch) {
      const key = kvMatch[1];
      const val = kvMatch[2];
      if (!val.includes('${') && !val.includes('{{') && WEAK_PASSWORD_VALUES.has(val.toLowerCase())) {
        violations.push(`${filePath}:${i + 1}: hardcoded weak credential for ${key}`);
      }
    }
  }

  // 4. Verify healthcheck presence on curated pack compose files
  if (requireHealthcheck && !/^\s+healthcheck\s*:/m.test(content)) {
    violations.push(`${filePath}: curated template missing healthcheck definition`);
  }

  return violations;
}

function findComposeFiles(dirPath, out = []) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      findComposeFiles(full, out);
    } else if (/^docker-compose(\..+)?\.ya?ml$/i.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

export function scanAllPacks(basePacksDir = packsDir) {
  const packDirs = fs.readdirSync(basePacksDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  let scannedFiles = 0;
  const allViolations = [];

  for (const packName of packDirs) {
    const packPath = path.join(basePacksDir, packName);
    const composeFiles = findComposeFiles(packPath).sort();
    const isCurated = packName === 'paas-template-pack-curated';

    for (const filePath of composeFiles) {
      scannedFiles++;
      const relPath = path.relative(rootDir, filePath).replace(/\\/g, '/');
      const content = fs.readFileSync(filePath, 'utf-8');
      const violations = validateComposeContent(content, relPath, {
        requireHealthcheck: isCurated,
      });
      allViolations.push(...violations);
    }
  }

  return { packCount: packDirs.length, scannedFiles, violations: allViolations };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const result = scanAllPacks();
  if (result.violations.length > 0) {
    console.error(`Compose security validation FAILED (${result.violations.length} violations across ${result.scannedFiles} files):`);
    for (const v of result.violations) {
      console.error(` - ${v}`);
    }
    process.exit(1);
  }
  console.log(`Compose security validation passed (${result.packCount} packs, ${result.scannedFiles} compose files).`);
  process.exit(0);
}
