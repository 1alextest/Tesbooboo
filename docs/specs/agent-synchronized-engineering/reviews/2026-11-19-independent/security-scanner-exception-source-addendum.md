# Independent Security — scanner exception source addendum

## Disposition

**The implemented source correction satisfies the bounded SEC-NATIVE-04 remediation design. Runtime closure remains pending.** The exception now requires the reviewed repository-root file, the generic-api-key detector and an exact independently verified content-hash mapping together. The real scanner controls and final repository scan have not run in this reviewer session; this addendum does not close the finding or supersede the red source965 scan.

This is a separate read-only source challenge. The earlier security-native-transport-closeout.md and its input manifest remain byte-for-byte unchanged. No product, methodology, workflow, scanner configuration or test harness was edited by this reviewer.

## Exact source binding

The review started with main-repository HEAD be0240f413780770c427c4b589a29348d900ec65 and completed with HEAD 0e52c23367246a15f47c99d80288dafe55ed8151. Git confirms that intervening upstream delta changes only e2e/api/mcp.spec.ts. The three reviewed scanner files were uncommitted working changes and are bound by their exact hashes below; no committed or runtime status is inferred from HEAD alone.

| Reviewed file | Final SHA-256 |
| --- | --- |
| .gitleaks.toml | 5d49ca03d4745a30ce27e2f70eaf5219c95b8d07259dbe37d66d4715817c5b61 |
| scripts/check-gitleaks-evidence-exceptions.py | 4b4d1cbf7ad761126b3c0f2cf49b892a4a7ccb57cc49f4ce0417300871010557 |
| .github/workflows/free-repository-security.yml | fba63f971e7ef65e73df97a6c66c10e16ab3856583d5d3d5e895117d732d18f1 |

The initially inspected harness was d4a7ac40dff1336e580d1e35a10440ade135fd1b58dbda2fd039ca894f3fd3d2. The driver renamed its two path constants following the observation below. Reversing only those identifier renames in memory reconstructs the exact initial hash, proving that the repair did not change fixture values, control cases, subprocess flags or assertions.

The unchanged method and target application binding remain those in the frozen transport receipt. This addendum concerns the secret-scanning assurance boundary, primarily S5; it does not reopen or enlarge SEC01/SEC02 closure, and SEC03 remains open.

## Configuration scope verified

The full configuration was opened and parsed. It preserves the default rules through useDefault=true and contains exactly three allowlists, each with targetRules limited to generic-api-key, condition AND and regexTarget match (.gitleaks.toml:4–29).

The entries pair historical evidence deliberately:

- The two source9519 Green profiles permit their old frontend API digest and canonical-contract digest only.
- The original occurrence-repair receipt permits the source965 frontend API digest only.
- The new source965 v3 Green profile permits the newer API digest and canonical-contract digest only.

All patterns anchor at the repository-relative root or the documented /repo mount; no arbitrary preceding directory or filename suffix is allowed. No global path exemption, wildcard hash value, rule disable, ignore marker or finding baseline is added.

I independently parsed the four retained JSON files and found all seven intended logical mappings. Source-only regex checks verified that each intended detector-match string satisfies exactly one allowlist for both relative and /repo-prefixed paths. Twenty-eight outside/nested/suffix path combinations were refused, and historical digest swaps between old profiles, the occurrence receipt and v3 were refused. This confirms the expressed scope in Python-compatible pattern evaluation; it is not Go RE2, entropy/filter behavior, actual scanner File representation or Gitleaks execution.

Official Gitleaks README/config source already inspected in the frozen receipt supports this combination: targetRules attaches the exception to those rules rather than the global list, and AND combines path and match criteria. Actual installed-image behavior remains a CI obligation.

## Harness and workflow source challenge

| Boundary or potential failure | Source-read result |
| --- | --- |
| Before-control accidentally inherits repository exceptions | The harness creates an explicit default-only config, and every container receives an explicit /control.toml path. Automatic repository-config discovery cannot silently contaminate the before-control (script:87–104). |
| Baseline input never reaches the detector | The seven known mappings must produce the expected generic-api-key counts under defaults, with exactly seven total findings, before corrected-config suppression is accepted (script:95–104). |
| Exception becomes broader than the reviewed paths/digests | Nine denied neighbors run through both configurations: outside path, nested lookalike, different filename, suffix extension, different digest, wrong historical digest, generic credential, provider credential and extra same-line credential (script:106–130). |
| Same-line exception hides an additional secret | The before-control requires two generic findings; the corrected case requires exactly one, retaining the additional credential (script:127–130). |
| Other default rule silently disappears | The provider fixture must produce github-pat in both configurations; targetRules does not exempt that provider rule (script:110,119,124–126). |
| Scanner/configuration failure mistaken for a successful negative | Each case has a fresh report directory. Exit must be 0 or 1, a report must exist, JSON must be a list, and exit status must agree with whether findings exist. Expected path/rule witnesses then must be present (script:32–70). Missing report, malformed JSON, unexpected path or missing required finding fails closed. |
| Old findings accidentally satisfy a new control | Each label gets a separate fresh checkout/report path; no prior report is reused (script:33–41,50–62). |
| Synthetic values pollute the real repository scan | Credentials are constructed during execution from fixed non-secret seed phrases, in a TemporaryDirectory outside the checkout. The container sees only that case's temporary checkout. Reports are separate and only rule IDs/paths are printed (script:38–48,63,87–130). |
| Controls pass with a different scanner from the real scan | Workflow pulls once, resolves the image ID, logs its ID/digests and CLI version, then passes that same ID to the harness and the final full scan (workflow:37–42). |
| Corrected scan no longer scans the repository or ignores findings | The final command still scans /repo read-only with the repository config, redact, verbose output and exit-code 1. The job retains its 12-minute timeout and has no continue-on-error or conditional bypass (workflow:25–42). |

The harness performs 20 scanner invocations if it reaches its final success line: two aggregate known-map scans and both configurations for each of nine denied neighbors. The full repository scan is a separate subsequent invocation. This is the source-prescribed sequence, not an executed result count.

Expected findings for denied cases are minimum counts because provider detectors may also produce overlapping generic findings. The known-map and same-line controls have exact counts where unexplained additions or excess suppression matter. This does not let absence of the requested rule be counted as a pass.

Captured subprocess diagnostics are intentionally not printed by the harness, reducing accidental value exposure. This makes some scanner errors less descriptive, but does not convert them to success. The final ordinary scan uses verbose redacted output to identify any remaining repository finding.

## Independent observation and correction

**SCANNER-SOURCE-01 — likely harness self-scan false positive; LOW operational impact, source-only confidence.** In the initial harness, line 23 named the canonical document filename using a constant ending in KEY. The official generic detector's identifier pattern matches that assignment, and the non-secret filename's entropy is 3.8492, above its documented 3.5 threshold. The ordinary alphabetic-only exception does not match the filename because it contains digits. This was a candidate established by primary-source pattern inspection and a Python evaluation, not a claimed actual scanner finding; full default stopword/filter behavior was not executed.

The driver renamed CONTRACT_KEY to CONTRACT_PATH and API_KEY to API_PATH, preserving their string values and all controls. The source-only candidate check no longer reports such a line. The exact hash reconstruction described above confirms this was only an identifier correction. No script-specific exception, disabled rule or weaker assertion was added.

The observation is preserved here without reproducing the triggering assignment in this retained evidence file. The final real repository scan remains the authority for whether any further harmless documentation/fixture literal is detected.

Additional primary source reopened for this check:

- https://github.com/gitleaks/gitleaks/blob/master/cmd/generate/config/rules/generic.go — generic identifier/value pattern, 3.5 entropy threshold, standard match/line/secret allowlists.

## Evidence level and remaining closure requirement

Executed locally: Python syntax parsing without running the harness, TOML parsing, independent logical-map lookup in the retained JSON, compatibility checks for the configured path/match expressions, SHA-256 verification and exact pre/post identifier-change reconstruction. These are source/artifact checks only. No Docker, Gitleaks, Go compiler, database, service, API or browser execution occurred.

SEC-NATIVE-04 remains **SOURCE MITIGATION PRESENT / ACTUAL SCANNER VERIFICATION PENDING**. Closure requires the actual published-source CI run to show all intended before/after controls, log the resolved scanner identity/version, and pass the final unchanged-strength repository scan. Unexpected findings or scanner failures must be investigated; this review authorizes no broader exception.

The source review found no surviving material configuration-scope defect in the hashed correction. The final product/release and all broader human-assent, origin-attribution and original-I3 gates remain outside this addendum.
