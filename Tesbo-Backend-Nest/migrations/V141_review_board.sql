-- Review Board: deterministic duplicate / similar test-case analysis, one project at a time.
--
-- review_analysis_runs  — one row per "Start Analysing" click. The partial unique index below is what
--   makes a second concurrent run for the same project impossible (not merely discouraged): the
--   loser's INSERT fails with 23505 and the API answers 409. heartbeat_at is a lease, like
--   analytics_report_runs.claimed_at (V137): a run whose worker died is expired by the next
--   start/status read once it has been silent for 10 minutes, so it can never block the project forever.
--
-- review_recommendations — one row per UNORDERED pair of test cases. testcase_a_id < testcase_b_id is
--   enforced, so (A,B) and (B,A) cannot both exist and a re-run upserts instead of duplicating.
--   fingerprint_a/b record the content of each side when the pair was last detected. They serve two
--   purposes: a reviewer's decision is kept across runs while the fingerprints still match, and an
--   action (remove / edit) is refused when either test case has materially changed since analysis.
--
-- Nothing here deletes or edits a test case. Removal goes through the existing soft delete.
CREATE TABLE review_analysis_runs (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id         UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    status             VARCHAR(16) NOT NULL DEFAULT 'queued'
                         CHECK (status IN ('queued', 'running', 'completed', 'failed')),
    requested_by       UUID REFERENCES users(id) ON DELETE SET NULL,
    testcases_analyzed INT,
    pairs_found        INT,
    truncated          BOOLEAN NOT NULL DEFAULT false,
    error              TEXT,
    heartbeat_at       TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at         TIMESTAMPTZ,
    finished_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_review_runs_one_active
    ON review_analysis_runs(project_id)
    WHERE status IN ('queued', 'running');
CREATE INDEX idx_review_runs_project_created ON review_analysis_runs(project_id, created_at DESC);

CREATE TABLE review_recommendations (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id         UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    testcase_a_id      UUID NOT NULL REFERENCES testcases(id) ON DELETE CASCADE,
    testcase_b_id      UUID NOT NULL REFERENCES testcases(id) ON DELETE CASCADE,
    classification     VARCHAR(16) NOT NULL CHECK (classification IN ('exact_duplicate', 'similar')),
    similarity         NUMERIC(4, 3) NOT NULL,
    explanation        TEXT NOT NULL,
    differences        JSONB NOT NULL DEFAULT '[]'::jsonb,
    fingerprint_a      TEXT NOT NULL,
    fingerprint_b      TEXT NOT NULL,
    review_status      VARCHAR(16) NOT NULL DEFAULT 'pending'
                         CHECK (review_status IN ('pending', 'kept', 'edited', 'removed', 'obsolete')),
    reviewed_by        UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at        TIMESTAMPTZ,
    removed_testcase_id UUID,
    last_run_id        UUID REFERENCES review_analysis_runs(id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT review_recommendations_ordered_pair CHECK (testcase_a_id < testcase_b_id),
    CONSTRAINT review_recommendations_unique_pair UNIQUE (project_id, testcase_a_id, testcase_b_id)
);

CREATE INDEX idx_review_recs_project_status ON review_recommendations(project_id, review_status);
-- The FKs cascade on a hard delete of a test case; without these that is a scan per deleted row.
CREATE INDEX idx_review_recs_testcase_a ON review_recommendations(testcase_a_id);
CREATE INDEX idx_review_recs_testcase_b ON review_recommendations(testcase_b_id);
