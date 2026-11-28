-- Approval is bound to the exact reviewed case revision, not to a later mutable row.
--
-- `approved_revision` is the editRevision the reviewer saw (the CAS hash). The status transition
-- to Approved rechecks that same hash inside its transaction; a change between review and
-- approval is a 409 and writes nothing. The case's revision after approval is necessarily newer
-- (the status itself changed), so the receipt stores the reviewed hash, not the post-approval one.
CREATE UNIQUE INDEX IF NOT EXISTS idx_testcases_id_project ON testcases(id, project_id);

CREATE TABLE IF NOT EXISTS testcase_approval_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  testcase_id UUID NOT NULL,
  approved_revision CHAR(64) NOT NULL,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (testcase_id, approved_revision),
  FOREIGN KEY (testcase_id, project_id) REFERENCES testcases(id, project_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_testcase_approval_receipts_case ON testcase_approval_receipts(testcase_id, created_at DESC);
