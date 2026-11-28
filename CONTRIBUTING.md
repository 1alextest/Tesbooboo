# Contributing to Tesbo Test Manager

Thanks for helping improve Tesbo Test Manager.

Tesbo Test Manager is exclusively developed and maintained by QAble Testlab.

## Development

Tesbo Test Manager has four independently installed TypeScript projects:

- `Tesbo-Frontend/` - Next.js frontend
- `Tesbo-Backend-Nest/` - NestJS API
- `e2e/` - Playwright API/UI/regression suite
- `sdk/playwright-reporter/` - publishable reporter SDK

Read [AGENTS.md](AGENTS.md) for the canonical engineering principles before editing:
audit the architecture and upstream/downstream impact, find existing owners, and reuse or extend
them before introducing another implementation. Follow [CLAUDE.md](CLAUDE.md) for database safety
and the separately approved impacted-E2E execution procedure.

[CI quality and impact checks](docs/ci-quality.md) documents the executable gates, their limits,
and the remaining rollout. Static impact selection is not evidence that tests ran.

Before opening a pull request, please run the relevant checks for the area you changed:

```bash
cd Tesbo-Frontend
npm ci
npm run lint
npm run build
```

```bash
cd Tesbo-Backend-Nest
npm ci
npm run lint
npm run typecheck
npm test
```

```bash
cd sdk/playwright-reporter
npm ci
npm run typecheck
npm run build
npm test
npm run test:package-consumer
```

```bash
# Repository root: offline source analysis, except dependency installation/auditing
npm ci --ignore-scripts
npm run test:quality
npm run quality:architecture
node scripts/check-quality-policy.mjs --base origin/development
npm run quality:duplication -- --base origin/development
npm run quality:impact -- --base origin/development --graph reports/quality/dependencies.json --output reports/quality/impact.json
node scripts/check-migrations.mjs --base origin/development
```

## Pull Requests

- Keep changes focused and explain the user-visible behavior.
- Record the architecture/reuse evidence and affected consumers before implementation.
- Review the generated impact plan; justify unchanged affected layers rather than editing them unnecessarily.
- Include tests or validation notes for behavior changes.
- Distinguish selected tests, executed results, skips, blockers and remaining uncertainty.
- Do not commit secrets, local `.env` files, logs, uploads, screenshots, database dumps, or build output.
- By submitting a contribution, you agree that it is licensed under the Apache License 2.0.

## License

Tesbo Test Manager is licensed under the Apache License 2.0. See `LICENSE`.
