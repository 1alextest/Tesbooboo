# Native retest evidence — exact scanner exception review

**Reviewer:** `/root/native_retest_backend_review`

**Date:** 2026-11-20 UTC

**Disposition:** No concrete blocker found in the frozen policy/helper delta. Source and static boundary review passes; corrected real-scanner controls and the complete repository scan remain a required CI result.

## Independently checked observation and review sequence

This is an informed review: the coordinator supplied the suspected prose false positive. Before reading the proposed correction, the reviewer independently fetched [job 136150849272](https://github.com/1alextest/Tesbooboo/actions/runs/44695397892/job/136150849272), checked the frozen report, retrieved the upstream detector rule, and recorded the acceptance boundary. The existing policy/helper were then read from the original PR head; the frozen proposed delta was examined afterward.

The failed `current-tree-secrets` job in run `44695397892` scanned PR173 merge commit `174ed8d62d55161035c30a4556f09d02f28cec30`: head `aede3e951d26b99b09263883db9e08d15f6abe6f` into base `8c254130384c7d6ae93dd7f10b9bfa271007e224`. It used Gitleaks v8.30.1, image ID `sha256:4b81af4c7b4159acfdbbbfede6647bf49b4c9f24dc2a2bbd4581f39d5223fcfa`, and reported one `generic-api-key` finding at the retained report's line 56. Existing seven mapping controls and nine denied-neighbor controls passed before that finding.

The actual capture is ordinary review prose, `anonymous/foreign`, with calculated entropy 3.528064311584049 against threshold 3.5. The independently reconstructed complete match includes preceding request-key/status prose and a final space. No credential exists on that line. Published report bytes equal the original frozen report. This receipt deliberately does not repeat the complete detector span as another unreviewed fixture.

Primary scanner sources: [v8.30.1 rule configuration](https://github.com/gitleaks/gitleaks/blob/v8.30.1/config/gitleaks.toml), [detector](https://github.com/gitleaks/gitleaks/blob/v8.30.1/detect/detect.go), and [allowlist implementation](https://github.com/gitleaks/gitleaks/blob/v8.30.1/config/allowlist.go). The detector retains the final space in `Match`; it trims newline characters only before assigning that field.

## Frozen candidate binding

Repository: `/workspace/scratch/8e9074abd0d0/tesbo-qa-loop`. Paths below are repository-relative.

| File | SHA-256 |
| --- | --- |
| `.gitleaks.toml` | `f08214874e99dacaf4cc003b9453d693f3f91cb942ff3f8f0a24a8e65469f0de` |
| `scripts/check-gitleaks-evidence-exceptions.py` | `a2449d6fa79211adf20fb55a8bbb58fc0906cb6a3bba9fcc692ddafcfe63f6a3` |
| `docs/specs/agent-synchronized-engineering/reviews/2026-11-20-native-qa/native-backend-fix-review.md` | `b084c144d6ba7f150c692b6065132cfd45e94309871c4182164044ec7f9e1b78` |

## Boundary and control assessment

- The delta adds one exception restricted to `generic-api-key`, the exact repository-root report path (with optional scanner `/repo/` prefix), and the exact complete match under `condition = "AND"` and `regexTarget = "match"`. The slash character class contains only a literal slash; the final literal space is required. No whole-line/file suppression, rule disabling, or broader existing exception was introduced.
- The helper fails on changed original report SHA and requires exactly one actual reviewed prose line. It uses that line for a real-scanner default-one/corrected-zero positive control. It retains every prior mapping and denied-neighbor control.
- Seven added denied controls cover outside, nested and suffixed paths; altered prose; synthetic generic and provider credentials at the allowed path; and an additional generic credential on the same line. The latter requires two findings under defaults and one after correction, distinguishing an exact exception from suppression of the entire line. Credentials are disposable synthetic values; scanner reports remain redacted.
- Reviewer-performed pure checks confirmed TOML/Python syntax, unchanged previous policy entries/default-rule extension, exact accepted path/match boundaries and rejected neighboring strings. The altered-prose control still exceeds the upstream entropy threshold. These checks do not substitute for the real scanner.

No policy, product, test or original evidence file was edited by this reviewer. No local database, application or real-scanner execution occurred. The next CI must run the helper and complete tree scan with the same resolved scanner image before claiming the security gate is green. This receipt grants no broader security certification or merge/deployment approval.
