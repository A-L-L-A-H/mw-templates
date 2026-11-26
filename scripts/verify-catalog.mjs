import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const packsDir = path.join(rootDir, 'packs');
const manifestPath = path.join(rootDir, 'catalog-manifest.json');

function getAllFiles(dirPath, arrayOfFiles = []) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
      getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  }
  return arrayOfFiles;
}

if (!fs.existsSync(packsDir)) {
  console.error(`Packs directory not found at ${packsDir}`);
  process.exit(1);
}

const packFolders = fs.readdirSync(packsDir, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name)
  .sort();

if (packFolders.length === 0) {
  console.error('No packs found in packs/');
  process.exit(1);
}

const manifest = {
  version: 1,
  generatedAt: '2026-11-26T00:00:00.000Z',
  packs: {},
  summary: {
    totalPacks: packFolders.length,
    totalFiles: 0,
    catalogSha256: ''
  }
};

const fileHashes = [];

for (const packName of packFolders) {
  const packPath = path.join(packsDir, packName);
  const files = getAllFiles(packPath).sort();

  if (files.length === 0) {
    console.error(`Pack ${packName} is empty!`);
    process.exit(1);
  }

  let packFileCount = 0;
  const packFileEntries = [];

  for (const filePath of files) {
    const relToRoot = path.relative(rootDir, filePath).replace(/\\/g, '/');
    const content = fs.readFileSync(filePath);
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    fileHashes.push(`${relToRoot}:${hash}`);
    packFileEntries.push({ path: path.relative(packPath, filePath).replace(/\\/g, '/'), sha256: hash });
    packFileCount++;
  }

  const packHasher = crypto.createHash('sha256');
  for (const entry of packFileEntries) {
    packHasher.update(`${entry.path}:${entry.sha256}\n`);
  }
  const packDigest = packHasher.digest('hex');

  manifest.packs[packName] = {
    fileCount: packFileCount,
    digest: packDigest
  };

  manifest.summary.totalFiles += packFileCount;
}

fileHashes.sort();
const catalogHasher = crypto.createHash('sha256');
for (const item of fileHashes) {
  catalogHasher.update(`${item}\n`);
}
manifest.summary.catalogSha256 = catalogHasher.digest('hex');

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');

console.log('Catalog verification succeeded.');
console.log(`Total packs: ${manifest.summary.totalPacks}`);
console.log(`Total files: ${manifest.summary.totalFiles}`);
console.log(`Catalog SHA-256: ${manifest.summary.catalogSha256}`);
for (const [name, info] of Object.entries(manifest.packs)) {
  console.log(` - ${name}: ${info.fileCount} files, digest ${info.digest.slice(0, 12)}...`);
}
process.exit(0);
