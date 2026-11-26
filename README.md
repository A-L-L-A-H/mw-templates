# MoonWitness Templates (`mw-templates`)

Standalone catalog repository containing static PaaS template packs extracted from `mw-xv`:
- `paas-template-pack-dokploy`
- `paas-template-pack-coolify`
- `paas-template-pack-bigbear`

## Verification

To scan `packs/` and generate deterministic `catalog-manifest.json`:

```bash
node scripts/verify-catalog.mjs
```
