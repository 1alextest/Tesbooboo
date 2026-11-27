# Native handoff coverage readback — 27 November 2026

Read through the authorized project MCP connection (project `df072dfe-e4d0-406a-9350-e0d022c6323f`).
This is a readback of existing proposal tasks, not a TESBOPROJECT approval, publication, Test Run or
execution.

## Proposal tasks

| Task | Revision | Status | Proposal content |
| --- | --- | --- | --- |
| `2f20c10e-c1d3-4480-ba08-51f4cb04eca7` | `44cff570c008a8b1b8bb46eb4712f61642c73b5aaf305702e1fd3cd5ffab9dcd` | `in_review` | 1 generated, 0 saved; generated-but-unsaved case proposal for packet-bound generated change and fault controls |
| `601cc4f6-08e8-4fae-8b95-933010f2dc54` | `72d4982203eec734585ac5560e78fd2c09b0ce1f558b7369654f8241866704cf` | `in_review` | 1 generated, 0 saved; generated-but-unsaved case proposal for governed packet → reporter → closed Run/evidence |
| `55cf92ac-2d99-4952-9514-1283a7388f08` | `caabf4baf87b642cf99f5267623f77e92ac6cef17226a5cb77e1370f4d437743` | `in_review` | 1 generated, 0 saved; distinct automation failure → Bug → native manual retest contract proposal |

`0 saved` means none of these proposals produced a persisted native testcase. None has an apply
receipt, a native approval, a Test Run or execution evidence. They must not be described as saved
Draft cases.

## Official case inventory

At this readback (27 November 2026), the project returned 75 official test cases. Filtering their
titles for handoff, automation, generated, Playwright, reporter, retest or Bug returned only the
existing Bug-link cases `TES-TC-8`/`TES-TC-9`; no official case duplicates these proposals. This is
an inventory read, not a claim that no related case could be created later.

## Evidence boundary

- Hosted disposable CI runs `45975273556` (#317) and `45985939679` (#313) are engineering evidence.
- The governed CI project, requirement, case, approvals and Runs are disposable. They are not a
  human TESBOPROJECT approval and are not persistent PASS/FAIL evidence.
- Manual execution/UAT remains **UNRUN**.
- Current production health is the development merge SHA reported by `/api/health`; CI success is
  not manual or product acceptance.
