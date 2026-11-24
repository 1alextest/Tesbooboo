# Native retest — identity composition correction receipt

**Date:** 2026-11-20. **Reviewer:** `/root/native_retest_ui_review`.

**Verdict:** source review passes. No concrete blocker was found in this bounded two-file correction. Runtime and visual acceptance remain open; results from the earlier head do not certify the corrected head.

## Frozen scope

Reviewed against parent commit `aede3e951d26b99b09263883db9e08d15f6abe6f`, after the author's freeze notice.

Manifest: `native-ui-identity-composition-freeze.json`, SHA-256 `5ba17fe54b9f797bba26e0bfd9e897b28aaa1a55245c8a31e0f328efc657c7bd`.

| File relative to `tesbo-qa-loop` | SHA-256 |
|---|---|
| `Tesbo-Frontend/lib/routeParams.tsx` | `bd7fa90bdda90f02ba7a751309eb943aa286931c74c80046d5fa651409212f9d` |
| `Tesbo-Frontend/app/(app)/projects/[id]/layout.tsx` | `f462a38d1a908a8024ec10cf86cd7b152cb870fbdb9de2d96a375952800f72f4` |

The manifest and both file hashes match the announced freeze. This is an informed addendum; the four earlier UI assurance records were rechecked and remain unchanged.

## Findings

The route provider no longer imports or calls `useAppData`. Its existing project-layout owner reads the same `AppDataProvider` context and passes `currentUser?.userId` through the required `userId: string | undefined` prop. This removes the reported forbidden dependency from the library module to the application data component without introducing another identity store, authentication request or authorization rule.

The provider has one actual instantiation in the frontend, and that call supplies the new prop. The project layout remains below the existing application layout's `AppDataProvider`; the authenticated rendering gate and context ownership are unchanged. Reading the context one composition level higher preserves identity updates through ordinary prop rendering.

The inspected diff changes only identity composition. Existing current-user guards, user-bound recovery failure state, effect dependencies, pending-intent matching, UUID fallback and server receipt access are unchanged. An undefined identity still fails the existing truthy-user recovery checks. No test or request contract changed in this delta.

## Checks and acceptance limits

Performed independently: exact hash verification, complete two-file diff inspection, provider/caller and parent-context tracing, prior assurance-hash verification, and scoped `git diff --check` against the parent commit. All passed. This receipt contains no trailing Markdown hard-break spaces.

The freeze manifest attributes architecture validation (739 modules, zero forbidden edges), frontend/e2e TypeScript and scoped ESLint passes to the author. Those checks were not independently rerun here. No product/test edits, application launch, browser or database execution were performed by this reviewer.

Retain all 16 native UI journeys and the agreed impacted suite. Exact corrected-head CI, actual keyboard interactions and authentic screenshot review remain required. The earlier-head 256-test selection and UI runs were still in progress when this review was requested; this receipt makes no claim about their eventual results or production deployment.
