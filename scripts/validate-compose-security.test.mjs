import assert from 'node:assert/strict';
import test from 'node:test';
import { validateComposeContent } from './validate-compose-security.mjs';

test('blocks privileged: true', () => {
  const yaml = `
services:
  app:
    image: nginx:alpine
    privileged: true
`;
  const violations = validateComposeContent(yaml, 'test/docker-compose.yml');
  assert.ok(violations.some((v) => v.includes('privileged: true')));
});

test('blocks host root mounts', () => {
  const yaml = `
services:
  app:
    image: alpine
    volumes:
      - /:/host:ro
`;
  const violations = validateComposeContent(yaml, 'test/docker-compose.yml');
  assert.ok(violations.some((v) => v.includes('host root mount')));
});

test('blocks hardcoded weak passwords but allows template placeholders', () => {
  const weakYaml = `
services:
  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_PASSWORD=admin
`;
  const weakViolations = validateComposeContent(weakYaml, 'test/docker-compose.yml');
  assert.ok(weakViolations.some((v) => v.includes('hardcoded weak credential')));

  const safeYaml = `
services:
  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_PASSWORD={{RAND_HEX_24}}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready"]
`;
  const safeViolations = validateComposeContent(safeYaml, 'test/docker-compose.yml', { requireHealthcheck: true });
  assert.equal(safeViolations.length, 0);
});

test('requires healthcheck on curated templates', () => {
  const noHealthYaml = `
services:
  app:
    image: nginx:alpine
`;
  const violations = validateComposeContent(noHealthYaml, 'curated/docker-compose.yml', { requireHealthcheck: true });
  assert.ok(violations.some((v) => v.includes('missing healthcheck')));
});
