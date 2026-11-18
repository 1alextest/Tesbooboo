# Portable Tesbo synchronization rule — AGENTS.md / CLAUDE.md template

**Status:** Proposed agent instruction. Copy/adapt into the **target application's** agent instruction file only after the project is deliberately bound to Tesbo. This document in Tesbo's repo is not automatically loaded by agents developing other repositories.

> ## Keep application and engineering records synchronized
>
> For every feature, defect fix, behavior change, refactor or other implementation iteration:
>
> **1. Discover before writing.** Identify this repository's authorized Tesbo project binding and the connected Tesbo MCP tool catalog. Check the server's actual deployed/version identity and permissions. If missing, old or bound to a different project, **stop remote Tesbo writes** and report the gap. Never guess a project ID, store an API token in source, or switch projects to make an operation succeed.
>
> **2. Find the existing truth.** Search existing Tesbo requirements, approved policies, cases, KB documents/manuals, project work items, defects, graph change history and files as relevant. Preserve canonical IDs. Treat external Jira/Linear/Notion records as externally owned.
>
> **3. Assess relevance.** For each of Requirements, Test Cases, User Manual/Docs, Policy/Rules, Tasks/Issues, and Files/Evidence, determine whether the change: (a) requires a proposal; (b) leaves the domain unchanged; (c) does not apply; (d) is blocked; or (e) is deferred with an owner. Record a concrete reason and source for every non-update. Do **not** create redundant records simply to tick a box.
>
> **4. Implement and verify.** Enumerate expected behavior, affected journeys, negative/boundary/concurrency/security paths, and impacted existing tests. Write/run relevant unit, integration and end-to-end tests in the application. Record the exact tests and results; do not substitute the assertion that a test was authored. Distinguish local/CI from actual target deployment verification.
>
> **5. Propose synchronized Tesbo revisions.** For applicable domains, create or update the *existing* native requirement, linked test case candidate, KB manual section, decision/policy/rule proposal, work item/bug and supporting file/evidence. Link revisions to the same source change and preserve what was decided, why, by whom, and at which version. Use idempotency and revision guards where available. Where a required capability is absent, mark it **blocked** rather than improvise an ungoverned bypass.
>
> **6. Never self-approve.** An agent may author proposals and delegate specialized analysis, but cannot treat generated requirements, policy text, case links, or manuals as authorized without the relevant reviewer/approver. Follow Tesbo's actual status transitions; only approved cases may enter protected test runs.
>
> **7. Close with a receipt.** Summarize exact code/PR revision, Tesbo record links/revisions, tests executed and outcome, each artifact's disposition, proposed vs approved state, evidence integrity, missing verifications, blocked/deferred tasks and source/deployment identity. If the MCP service was unavailable, say **Tesbo sync not performed** and preserve a local proposal for later review; do not report completion as though remote changes succeeded.
>
> **8. Generalize reasoning, not app-specific decisions.** Reuse principles from precedent, then determine their applicability to this application's authenticated sources and authority. Do not transplant another project's rules or expected behavior.
>
> You may delegate analysis or artifact drafting to specialized agents while retaining the single parent change identity. Every remote action still uses the invoking agent's authorized Tesbo project and native reviewer policy.
>
> **Completion:** This work is not record-complete until the six-domain applicability assessment and truthful Tesbo synchronization receipt exist. A blocked domain remains visible as a blocker/exception, never silently passes.

## Notes for installing this rule

- Paste the block above (without the blockquote markup if desired) into the application's existing `AGENTS.md` or `CLAUDE.md`; do not overwrite existing security/test rules.
- Configure the **project-specific** Tesbo MCP connection through the client's authorized secret configuration. Nothing in this template is a credential or a fabricated server endpoint.
- Current Tesbo MCP already supports case/KB-document authoring and external requirement linking. It **does not yet implement the proposed ASER Change Packet/native requirement/policy/task workflow**. Until shipped, agents must identify unavailable pieces as gaps; the instruction is a target behavior, not a claim that it works now.
- Agent instructions improve invocation consistency but cannot enforce server-side permissions, version safety or coverage. Implement MCP contract checks and CI linkage gates in addition to prompts.
- Where an app already has its own native requirements or issue system, the project binding should declare that ownership and whether Tesbo stores authoritative records or read-only linked mirrors. Never silently overwrite either system.

## Optional task-oriented agent roles (not separate product authorities)

A single coding agent may work through these responsibilities itself, or assign analysis/drafting to specialists:

| Responsibility | Produces candidate | Approval owner |
| --- | --- | --- |
| Coding / Architecture | PR, behavior/source impact | code reviewer |
| Business Analysis | native requirement and criteria | designated requirement owner |
| QA | test case updates, verification plan and execution receipts | QA reviewer/authorized tester |
| Documentation | user manual/API/ops edits | document owner |
| Policy / Security | decision, invariant, rule/control proposal | policy authority |
| Project / Delivery | work item, issue link and residual actions | task owner/project lead |

Only Tesbo's existing project/role policy determines what an individual can actually publish; the table assigns no privileges.
