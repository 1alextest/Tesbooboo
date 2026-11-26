-- Knowledge Base upload request identity and restart-safe transcription recovery.
--
-- requestKey is caller-supplied and scoped to project + uploader; the file index is the batch
-- position. Filename/content equality never establishes identity. A partial unique index prevents
-- one logical slot from producing two rows under concurrent retries.
ALTER TABLE knowledge_files
  ADD COLUMN upload_request_key VARCHAR(160),
  ADD COLUMN upload_request_file_index INTEGER,
  ADD COLUMN upload_request_digest CHAR(64),
  ADD COLUMN extraction_claimed_at TIMESTAMPTZ,
  -- Fencing token: only the claim that currently owns this value may write a terminal
  -- extraction result, so a takeover cannot be clobbered by the previous owner.
  ADD COLUMN extraction_claim_token UUID;

ALTER TABLE knowledge_files
  ADD CONSTRAINT knowledge_files_upload_request_shape CHECK (
    (upload_request_key IS NULL AND upload_request_file_index IS NULL AND upload_request_digest IS NULL)
    OR (upload_request_key IS NOT NULL AND upload_request_file_index IS NOT NULL AND upload_request_digest IS NOT NULL)
  );

CREATE UNIQUE INDEX idx_knowledge_files_upload_request
  ON knowledge_files (project_id, uploaded_by, upload_request_key, upload_request_file_index)
  WHERE upload_request_key IS NOT NULL;

-- Boot recovery scans pending/abandoned transcription claims only.
CREATE INDEX idx_knowledge_files_transcription_recovery
  ON knowledge_files (extraction_status, extraction_claimed_at)
  WHERE is_deleted = false AND extraction_status IN ('pending', 'processing');
