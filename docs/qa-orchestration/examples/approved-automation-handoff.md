# Send one approved Tesbo case to a Playwright generator

A tester opens an applied requirement bundle under **Agents → Tasks**, approves its submitted requirement, approves the native test case, and activates the criterion link for that case. **Set up an automation handoff** on the Task page gives the tester the CLI command for that project and task. It appears on applied bundles with a saved case and an automation target. The CLI checks eligibility when the tester uses it.

Use this when a human wants an automation change for one reviewed case in an existing Playwright spec. The output is a local JSON work item for a generator the project already uses. The tester can compare the native criterion with the proposed test assertion before releasing that work item. Starting a generator, reviewing its code and recording an execution remain separate actions.

## Run it

1. Use a trusted checkout of the Tesbo version containing this bridge, Node 22 or 24, Git and a display for Chromium. Install the repository's locked Playwright tooling with `npm ci --prefix e2e --ignore-scripts` and `npm --prefix e2e run install-browsers`. The Tesbo API and web app must include this change. Use normal sign-in in the browser the CLI opens.
2. In the consuming project's Git repository, commit the investigation artifacts, its reviewed decision and plan, and the existing target spec. Push the reviewed tip to the intended GitHub branch. The native case needs its **Automation repository** in `owner/repository` form, **Automation path** and **Automation framework** set to Playwright at the reviewed case revision. Use a checkout whose target spec has the same bytes as the committed file. The branch lookup uses your trusted Git configuration and read access to that repository.
3. Obtain the pinned upstream code. The adapter reads two hash-verified checker modules directly from their Git objects. The target spec is treated as data.

   ```sh
   git clone https://github.com/QAtools-tech/qa-investigation-harness.git qa-investigation-harness
   git -C qa-investigation-harness checkout --detach a468921c2bead820520a97df897168487b2b4985
   ```

4. From the **Tesbo checkout**, run the command from the Task. Use the real published branch and full SHA the team reviewed. The following example shows the expected arguments. Replace the two lowercase UUID labels in the URL with the real values, or use the URL populated by the Task UI.

   ```sh
   node scripts/qa-approved-handoff.mjs \
     --task-url 'https://tesbo.example/projects/project-uuid/agents/tasks/task-uuid' \
     --api-origin 'https://api.tesbo.example' \
     --repo /path/to/consumer-project --branch feature/filter --revision "$TARGET_COMMIT" \
     --harness /path/to/qa-investigation-harness --investigation CASE-300 --case TC-01
   ```

5. Sign in to the selected project. At the terminal, inspect the approved case, criterion, risk, expected observation, mapped file, and source versions together. Several cases can share a file. Confirm only if this investigation case exercises this native criterion. Enter the displayed eight-character fingerprint to confirm. Press Enter to cancel. The script rereads the branch and file and asks Tesbo to validate the **same** receipt and revisions again. An ineligible or changed selection exits nonzero and yields no packet on standard output.
6. To retain a packet, redirect standard output to a **fresh, private local file** outside the working tree. The review display and questions use the terminal. For example, use `umask 077` before redirecting on a POSIX shell. Supply the file to the project's authorized generator only after a successful exit. Ask it to implement the selected case at `target.path`, assert the approved observation, and keep the code reviewable in a feature branch. A later authoring session should obtain a fresh packet before editing or proposing its patch. The packet captures conditions at the checks' times and carries project content, including test data.

A generated spec still requires a review of the diff, a successful baseline on the intended build, and evidence that its assertion catches the intended failure. The [Agentic QE exercise](../reviews/agentic-qe-candidate-handoff.md) shows how to test that last claim on a controlled defect.

## What the receiver gets

| Packet section | Source and information |
| --- | --- |
| `native` | Project, task, human apply receipt, original operation position and ID, current approved requirement version, exact criterion keys/text, active link, case ID and both case revisions. Case fields include preconditions, steps, test data, postconditions and automation target. |
| `native.provenance` | Technical producer and issuing identity where recorded, applying reviewer, requirement approver, case approval receipt and approver, exporting member and their role. Skill assignment/version/digest values refer to the original application. A shared machine grant identifies that grant. |
| `target` | Native GitHub repository and relative file, independently chosen branch, and the full commit matched to the published branch and local checkout. |
| `investigation` | Upstream investigation and case, pinned checker revision, target Git blob, selected plan section and its digest, reviewed risk and exact oracle, decision and source locations, and hashed evidence dependencies. |
| `selectionDigest` | SHA-256 of the JSON packet before adding this field. It identifies the locally confirmed selection. Native approval authority resides in the Tesbo records. |

## Dispositions at the boundaries

| Situation | Result |
| --- | --- |
| A human applied the draft but the case is still Draft, or a different case makes the requirement look covered | Withhold. Eligibility comes from the selected case's active link and both formal approvals. |
| Initial submitted version/link and final approved version/link have different IDs | Follow the stored source version and original link. Exact native lineage can succeed across the normal approval and reactivation flow. |
| Selected operation, receipt, project, criterion order, case content, requirement version or active link has changed | Withhold. Editing the case and approving its new content does not retrofit that content into the original bundle. Start from a bundle that covers the new definition. |
| Investigation plan contradicts the approved oracle, approval is proposed or ambiguous, evidence digest is stale, file is missing or a symlink, browser visibility is partial, or a gap remains | Withhold. The first adapter admits one unambiguous mapped case/risk with an actionable step and an explicit observable expectation. The native case must contain complete manual steps with an action and expected result. An unresolved shared step or unsupported extended step needs separate review. Database-only or API-only assertions need a separately specified evidence reader and review path. |
| Branch moved, target bytes changed, credentials expired, or a source cannot be verified | Withhold and reopen the selection. A retry reads fresh state. |
| Ordinary Zyra draft, requirement-only bundle, existing-case update, multi-risk plan, new target spec, private unpushed branch or non-GitHub repository | Outside this first adapter. The existing authoring and review flows continue to own these cases. |

The underlying API is a human-session read implemented as `POST /api/projects/{projectId}/requirements/proposals/{taskId}/automation-handoff` because the request includes a structured revision basis. It neither records a new approval nor creates an automation job. A machine token cannot impersonate the exporter. The human makes the semantic match between the two systems. The portal and the terminal do not mint a new identity for an external generator.

## How two team members use the same method

The exported Skill pins tell a reviewer which method governed the original application. A consumer that later authors or edits a Tesbo case over MCP must independently resolve the current approved assignment/version through the existing writer and submit a new revision through shared review. A historical pin in a downloaded packet grants no write scope. For team conformance, give two separately authenticated members the same task and Skill revision, check the required case structure, then run both resulting assertions against the same good and faulty fixtures. The wording can differ while both cases satisfy the same obligation. A credential shared by two people proves which grant acted. Individual attribution requires separately authenticated member/delegated identities. [Existing Skill delivery and conformance specification](../../specs/agent-synchronized-engineering/skills-governance.md#mandatory-skill-delivery-and-cross-member-authoring-conformance)

## Verification and native records

The existing Playwright requirements suite owns the applied-bundle → approval → activation → handoff scenario and its refusal cases. The Task browser test owns discovery of the command. For the standalone matrix and CLI checks, use a checkout of the pinned upstream source and run:

```sh
QA_INVESTIGATION_HARNESS_ROOT=/path/to/qa-investigation-harness \
  node --test scripts/qa-investigation-mapping.test.mjs scripts/qa-approved-handoff.test.mjs
```

Native synchronization candidate for TESBOPROJECT: reuse the requirement-bundle approval coverage and add the approved handoff plus stale/wrong-selection refusal to its reviewable QA coverage after searching the connected project. An existing automation spec, CI result or local fixture does not create a native case or Test Run. The change requires no new active Skill, manual, policy, Tasks/Bugs record or evidence store. The implementation PR holds the source and test evidence until a project-bound writer can stage a native proposal.

[Harness options](../ZYRA_QA_HARNESS_OPTIONS.md) · [Upstream generator contract](https://github.com/QAtools-tech/qa-investigation-harness/blob/a468921c2bead820520a97df897168487b2b4985/qa-harness/GENERATOR-ROUND-TRIP.md) · [Prior authoring comparison](zyra-proactive-authoring.md)
