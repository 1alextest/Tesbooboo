# Contributing to Tesbo Test Manager

Thanks for helping improve Tesbo Test Manager.

Tesbo Test Manager is exclusively developed and maintained by QAble Testlab.

## Development

Tesbo Test Manager is a monorepo with these main areas:

- `Tesbo-Frontend/` - Next.js frontend
- `Tesbo-Backend-Nest/` - NestJS/TypeScript API
- `e2e/` - Playwright end-to-end suite (API + UI)
- `sdk/playwright-reporter/` - Playwright reporter SDK

Before opening a pull request, please run the relevant checks for the area you changed:

```bash
# Frontend
cd Tesbo-Frontend
npm install
npm run lint
npm run build
```

```bash
# Backend
cd Tesbo-Backend-Nest
npm install
npm run lint
npm run typecheck
npm test
```

```bash
# E2E (impacted specs only; follow CLAUDE.md / repo test workflow)
cd e2e
npm install
npx playwright test --list
```

For behavior changes, follow the repository's end-to-end testing and database-safety rules in [CLAUDE.md](CLAUDE.md).

## Pull Requests

- Keep changes focused and explain the user-visible behavior.
- Include tests or validation notes for behavior changes.
- Do not commit secrets, local `.env` files, logs, uploads, screenshots, database dumps, or build output.
- By submitting a contribution, you agree that it is licensed under the Apache License 2.0.

## License

Tesbo Test Manager is licensed under the Apache License 2.0. See `LICENSE`.
