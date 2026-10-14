-- A Zyra chat reply that asks the user a question with clickable answers — today, whether a request
-- spanning many tickets should be narrowed to one or two tickets at a time or generated for all of
-- them in batches. Shape (see ZyraChatOptions in legacy.service.ts):
--   { kind, choices: [{id, label, description?, message?}], answeredId, context }
-- `context` holds what acting on an answer needs (the original request, the ticket keys) and is never
-- returned to the client. NULL on every message that asks nothing, which is all existing rows.

ALTER TABLE zyra_chat_messages ADD COLUMN options JSONB;
