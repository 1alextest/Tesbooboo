-- T-455: durable QA *handoff* relationships between existing graph receipts,
-- existing test runs, and existing test cases. Neither verification, a result,
-- nor a second source of test/run/evidence truth.
--
-- Production uses soft deletes for cases/runs, preserving these references.
-- Hard deletion of their parent records removes corresponding references.
CREATE UNIQUE INDEX graph_capture_history_project_id_id_uniq
  ON graph_capture_history(project_id, id);
CREATE UNIQUE INDEX cycles_project_id_id_uniq ON cycles(project_id, id);
CREATE UNIQUE INDEX testcases_project_id_id_uniq ON testcases(project_id, id);

CREATE TABLE graph_review_run_case_links (
  project_id UUID NOT NULL,
  history_id BIGINT NOT NULL,
  cycle_id UUID NOT NULL,
  testcase_id UUID NOT NULL,
  linked_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, history_id, cycle_id, testcase_id),
  CONSTRAINT graph_review_link_receipt_fk
    FOREIGN KEY (project_id, history_id)
    REFERENCES graph_capture_history(project_id, id) ON DELETE CASCADE,
  CONSTRAINT graph_review_link_cycle_fk
    FOREIGN KEY (project_id, cycle_id)
    REFERENCES cycles(project_id, id) ON DELETE CASCADE,
  CONSTRAINT graph_review_link_case_fk
    FOREIGN KEY (project_id, testcase_id)
    REFERENCES testcases(project_id, id) ON DELETE CASCADE
);
CREATE INDEX graph_review_run_case_links_project_cycle_idx
  ON graph_review_run_case_links(project_id, cycle_id);
COMMENT ON TABLE graph_review_run_case_links IS
  'Human-selected QA verification handoff only; no asserted test execution, coverage, defect, evidence or approval';
