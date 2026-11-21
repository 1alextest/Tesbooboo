import { expect, type APIRequestContext } from "@playwright/test";
import type { FakeAiServer } from "./fake-ai-server";
import type { MoveFixture, MoveRepositoryState } from "./zyra-move-feedback";
import { verifyZyraSingleMove } from "./zyra-single-move";
import type { MoveReviewPreview } from "./zyra-reviewed-moves";

export const ALIAS_MOVE_MODES = ["alias-scalars", "alias-lists", "alias-plus-missing", "scalar-only"] as const;
export type AliasMoveMode = typeof ALIAS_MOVE_MODES[number] | "alias-plus-foreign";
type SingleEvidence = Parameters<NonNullable<Parameters<typeof verifyZyraSingleMove>[0]["afterReply"]>>[0];

/** Reuse all existing move/persistence assertions; vary only the scripted provider's selectors. */
export async function verifyZyraAliasMove(input: {
  request: APIRequestContext; ai: FakeAiServer; base: string; ownerId: string; language: "en" | "ru";
  mode: AliasMoveMode; fixture: MoveFixture; foreignId?: string; state: () => Promise<MoveRepositoryState>;
  beforeApply?: (preview: MoveReviewPreview) => Promise<void>;
  afterReply?: (evidence: SingleEvidence & { mode: AliasMoveMode; expectedMissing: number; expectedHeadline: string }) => Promise<void>;
}) {
  const { fixture, state, mode, language, foreignId, afterReply, ...rest } = input;
  const row = (await state()).cases.find((entry) => entry.id === fixture.firstId)!;
  expect(row).toBeTruthy(); const externalId = String(row.external_id);
  if (mode === "alias-plus-foreign") expect(foreignId).toMatch(/^[a-f0-9-]{36}$/i);
  const targetSelectors = mode === "alias-scalars" ? { testcaseId: fixture.firstId, externalId }
    : mode === "alias-lists" ? { testcaseIds: [fixture.firstId, fixture.firstId], externalIds: [externalId, externalId] }
    : mode === "alias-plus-missing" ? { testcaseId: fixture.firstId, externalIds: [externalId, "E2E-ALIAS-TC-MISSING"] }
    : mode === "alias-plus-foreign" ? { testcaseIds: [fixture.firstId, foreignId!], externalId }
    : { testcaseId: fixture.firstId };
  const expectedMissing = mode === "alias-plus-missing" || mode === "alias-plus-foreign" ? 1 : 0;
  const expectedHeadline = expectedMissing ? language === "en" ? "⚠️ 1 named test case(s) could not be moved."
    : "⚠️ Не удалось переместить названные тест-кейсы: 1." : "";
  await verifyZyraSingleMove({ ...rest, fixture, state, language, selector: "testcaseId", targetSelectors,
    afterReply: async (evidence) => {
      const messages = evidence.session.messages as Array<Record<string, unknown>>;
      const assistant = messages.find((entry) => entry.role === "assistant")!;
      const content = String(assistant.content), activity = assistant.activity as Array<Record<string, unknown>>;
      const unresolved = activity.filter((entry) => entry.title === "Some testcases could not be moved");
      // Independent expected counts; no production patterns/catalog are imported.
      expect(content).toContain(expectedHeadline || evidence.reply);
      expect.soft(unresolved).toHaveLength(expectedMissing ? 1 : 0);
      if (expectedMissing && unresolved.length) expect.soft(String(unresolved[0].detail).startsWith("1 of 2 requested testcase(s)")).toBe(true);
      await afterReply?.({ ...evidence, mode, expectedMissing, expectedHeadline });
    },
  });
}
