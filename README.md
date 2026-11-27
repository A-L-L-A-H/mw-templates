# mw-templates — Static catalog of PaaS deployment template packs.

**Repository:** [`A-L-L-A-H/mw-templates`](https://github.com/A-L-L-A-H/mw-templates) · **Stack:** JSON · Node scripts

## What it does

Contains dokploy, coolify, bigbear, and curated packs extracted from mw-xv plus deterministic catalog validation.

## Quick start

```bash
node scripts/verify-catalog.mjs
node --test scripts/validate-compose-security.test.mjs
```

## Verify

```bash
node scripts/validate-compose-security.mjs
```

## Notes

The catalog verification script both regenerates catalog-manifest.json and validates the packs; the security validator checks Compose files. There are no runtime services; the verification scripts are the entry points.
