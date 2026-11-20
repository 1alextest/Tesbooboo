# Independent receipt integrity

Reviewer findings and verdicts are preserved. The table identifies each original reviewer artifact
and the repository copy. Recorded whitespace-only transformations satisfy the existing repository
whitespace gate; their exact reversible operations are recorded rather than claiming unchanged
bytes. No assertion, finding, evidence tier or verdict was edited. Source pins remain the pins
reviewed by the named reviewer, not the latest implementation head.

| Receipt | Reviewed source | Original SHA-256 | Repository SHA-256 | Transformation |
| --- | --- | --- | --- | --- |
| [blue-a.md](blue-a.md) | `288c89b` | `de0c7a52c993dbb0d1562604447b515310f816ecfe7ca425d8a54d2fde6a42c8` | `de0c7a52c993dbb0d1562604447b515310f816ecfe7ca425d8a54d2fde6a42c8` | None; exact bytes retained. |
| [blue-b.md](blue-b.md) | `288c89b` | `bb941ff9c5eb8eb7ab99c46cbb3314001292772835d8f4f3d04953a9a300a502` | `bb941ff9c5eb8eb7ab99c46cbb3314001292772835d8f4f3d04953a9a300a502` | None; exact bytes retained. |
| [qa-integration.md](qa-integration.md) | `3299691e` | `585d28eb35a4c98e73e2dcd4e317918263b5f55a784007c5ef98d90e3134c1c4` | `ae68e0cb748c37d4fdb7d06b9ea27e7891afc51ec26aa53da55d9f95d1128753` | One terminal blank line removed. Append one LF byte to reconstruct the original. |
| [red-independent.md](red-independent.md) | `288c89b` | `298f5a2cb056ec2a5fd989cf72ab3283045b24d313e4b15f9edc2d3dc8ee29cc` | `a0110725a8bd99dc7af2afefabef6c5caa4f861c864e06285dea9a2a134d095e` | Two trailing spaces removed from lines 3, 4 and 5. Restore exactly two spaces before each LF on those lines to reconstruct the original. |
| [eg-independent.md](eg-independent.md) | `288c89b` | `9b0fdd8ad5d4a6b856348d3a6a7c1575b8786a1b58e7e387fa0b6632f4af74a7` | `9b0fdd8ad5d4a6b856348d3a6a7c1575b8786a1b58e7e387fa0b6632f4af74a7` | None; exact bytes retained. |
| [qa-native-delta.md](qa-native-delta.md) | `3ebda243` | `5637c1a456b0ecfac0f17936a11173ed06fa221d791e398a236d33d650aa2672` | `5637c1a456b0ecfac0f17936a11173ed06fa221d791e398a236d33d650aa2672` | None; exact bytes retained. |
| [security-native.md](security-native.md) | `8707d56a` | `c51af8a100a87ceea0cdac22c75171cb8861c79d09054dbf974e0ecb5c51ea81` | `c51af8a100a87ceea0cdac22c75171cb8861c79d09054dbf974e0ecb5c51ea81` | None; exact bytes retained. |
| [grey-independent.md](grey-independent.md) | `288c89b` / `3ebda243` | `f2cef95ee098b90cb238835ee1f74d4a60255eceac42ddfbdc6d1bf167a4f79a` | `8293b29111bb2aa2904dc3197dc0f68870c80237e4f0b397cc7d482ef221b711` | One terminal blank line removed. Append one LF byte to reconstruct the original. |
| [grey-reconstruction-before-crosswalk.md](grey-reconstruction-before-crosswalk.md) | Original canonical package; pre-crosswalk checkpoint | `711f42ed79922a9c59f222f35b8f85ba8cbdb53152efcc6aa5c304ead8bb4234` | `711f42ed79922a9c59f222f35b8f85ba8cbdb53152efcc6aa5c304ead8bb4234` | None; exact bytes retained. |
| [purple-native.md](purple-native.md) | `288c89b` / `3ebda243` source; actual `207f7cbb` report | `5788d5554931fce22b46559dbd76f9c482bfd3952a9f787d700568eff2c35520` | `b1aead8e647a2aed3e956216872272ee5d87a00f52a89d4d4e62518ffa375602` | Two trailing spaces removed from lines 3 and 4. Restore exactly two spaces before each LF on those lines to reconstruct the original. |
| [grey-independent-challenge.md](grey-independent-challenge.md) | Original Grey receipt and `3ebda243` source | `04a80c363b2638be05228485d655063c1b74385f2b8438da52d261c38fde24c0` | `2ae410aa072cf470da0ccc76501084be6d1fe26c3e199a836fa30a1d2c9506ff` | Two trailing spaces removed from lines 3 and 4. Restore exactly two spaces before each LF on those lines to reconstruct the original. |
| [white-prearchitecture.md](white-prearchitecture.md) | Canonical v1.4.28, immutable `288c89b` / `3ebda243` and completed prearchitecture receipts | `3ef21ed86b51a88d857b1310c85a5583185c9d10eb7d0084e2f5f4c90af5a33a` | `484b068eae9015a2eb08451a28c3697ac812986d128c0820a4b9057010e877e4` | Trailing whitespace removed; exact reversible removals: [{'line': 3, 'removed_hex': '2020'}, {'line': 4, 'removed_hex': '2020'}]. |

The Grey reconstruction checkpoint is retained beside its receipt so the review does not depend
on the original scratch link. Other local source links identify the pinned checkout used by each
reviewer; those source commits and build identities remain explicit in the respective evidence index.

## Captured local log bytes

Original scratch logs remain unchanged. These five repository copies remove only trailing whitespace emitted by ts-jest; the hex bytes below are restored immediately before the named line endings to reconstruct the originals. All test counts, diagnostics, source pins and failure text are retained. Other included logs are exact copies.

| Captured log | Original SHA-256 | Repository SHA-256 | Removed whitespace (hex) |
| --- | --- | --- | --- |
| [qa-delta-contract-probes.log](qa-delta-contract-probes.log) | `4f52b8087d3ee1fcd371055bb79c77710df4ef847ace720bf199d29092ffa59f` | `7b24212452b12c83b84c4af0909a293b3895726516151bc18522e9e718368391` | line 1: `20`, line 3: `2020` |
| [qa-delta-jest.log](qa-delta-jest.log) | `e8d34f2cf2618046e780029a27c17af83e6c1eb9bd480b81036244e520cae97f` | `eea371c00f1ae957adbff609b23e711bab7ccc00a47e550f84fe313c75c896a5` | line 1: `20`, line 3: `2020` |
| [qa-delta-model-http.log](qa-delta-model-http.log) | `4af5c62be95ec2618b118fb19d754fb247cbd7987cc22e9138c1915506cef9a7` | `7701dd141b6599ed9b4bd412be38d3a994a88567b8061174b4d93c27a4f17665` | line 1: `20`, line 3: `2020` |
| [qa-independent-contract-probes.log](qa-independent-contract-probes.log) | `dc4ac10169f89ab070eff5dcbbea6e693f16236dd4d7b02427eb01a134dbf95c` | `1880835d2eb9b9e0fc58e97dda34ffb27cef433c4e83489569f5faaf69d5404a` | line 1: `20`, line 3: `2020` |
| [suite-publication-before.log](suite-publication-before.log) | `8dd6a4c2a0c8cd8cd464e0a91bea51a315276f2cb4da1365d7534a0c12c34e35` | `92908a219464c5d99fc6313cc26a998677199c1db0bfd3a54ca4f8440667d68e` | line 1: `20`, line 3: `2020` |

## Later native review checkpoints

The following are separate pinned receipts, not replacements for earlier verdicts.

| Receipt | Reviewed source | Original SHA-256 | Repository SHA-256 | Reversible transformation |
| --- | --- | --- | --- | --- |
| [security-native-final-delta.md](security-native-final-delta.md) | `8db53c1f` / `9519b56d`; identical merge `0d510c59` | `441a3a37ef678da8db43670b24e7ed2af97f9bd304df8841125f390d6bba3640` | `441a3a37ef678da8db43670b24e7ed2af97f9bd304df8841125f390d6bba3640` | Exact bytes retained. |
| [qa-native-final-delta.md](qa-native-final-delta.md) | `8db53c1f` / `9519b56d`; identical merge `0d510c59` | `57c9ca7324a16afe16fc6953598fa94de4a0bbaaf584bf802993306c0bbed491` | `57c9ca7324a16afe16fc6953598fa94de4a0bbaaf584bf802993306c0bbed491` | Exact bytes retained. |
| [green-native-root-grounding.md](green-native-root-grounding.md) | `9519b56d`; disclosed implementation-author member | `ff84f0aef2b158e7a0f41a7098f2a92d3f497f84c7c183ce4fbaafe74f12c8e8` | `ff84f0aef2b158e7a0f41a7098f2a92d3f497f84c7c183ce4fbaafe74f12c8e8` | Exact bytes retained. |

## Green binding and later independent probe support

The exact original and repository SHA-256 values for the supplemental receipts, probes and logs are recorded in [native-review-support-integrity.json](native-review-support-integrity.json). It explicitly records any reversible trailing-whitespace or terminal-LF normalization; originals remain unchanged. Both the first native trace profile and the corrected v2 are retained. Independent Green found the first profile's semantic KB trace error despite its mechanical pass; the separate correction/addendum preserves that distinction. The final native Green verdict is still blocked by GREEN-NATIVE-01 at source `9519b56d`.


The supplemental index also preserves `qa-selected-fixture-delta.md` and the authored `i3-native-owner-fit.md` memo with their actual provenance. The latter is design authoring, not an independent assurance vote; its physical alternatives remain unselected. Exact source/file pins and runtime limits remain in each artifact.

## Source965 supplemental evidence

The same reversible index now retains the actual source965 Green occurrence review/probes,
its v3 trace profile and independent checker result, the disclosed author-member grounding,
Security transport closeout, QA approval-fixture and upstream-account reconciliation,
Purple's actual image review, and White's separate I3 owner-admission review. The actual CI
logs retain their source965/mergee49 identities. Earlier receipt verdicts and raw scratch bytes
are unchanged; later addenda record later evidence instead of rewriting earlier conclusions.
The v3 trace check establishes declared binding integrity only, not semantic coverage or an
executed Graph harness. Corrected screenshot and scanner runtime evidence is still pending.
