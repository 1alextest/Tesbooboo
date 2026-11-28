# Supplemental unchanged guard recovery

Source: `NesberryEnterprise/Nesberry@d83549c85a4dcd047fb40dc4fba4ec62737ab0fc`, `.kiro/steering/NESBERRY_AI_CODING_GUARD.md`.

The initial local transfer appended one extra terminal newline. Security's immutable original receipt correctly records the bytes it actually read: SHA-256 `7e351122a9821ec1331b8b795ceaa565590b7c2221efc3aa533e1a957da11528`.

The local recovery file was subsequently corrected to the exact fetched pinned source text and equality checked: 9,982 UTF-8 bytes, SHA-256 `fb8dd84e4d36acce04591a409f8aac8e4a123505298f6021a2c6a075fd0e789d`, computed Git blob identity `ee3af73bbda48e3a897d1a8cc58f2d81f15409c7`. The only difference is the extra final blank line; no rule, wording or authority changed. The original Security receipt remains unchanged. A later Security delta should cite the corrected exact-source identity and this transfer limitation.
