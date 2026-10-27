BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
CREATE TABLE wgh.wgh_video_access (
    user_id bigint PRIMARY KEY REFERENCES wgh.app_user(user_id) ON DELETE CASCADE,
    approved boolean NOT NULL DEFAULT false,
    revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
    updated_by bigint REFERENCES wgh.app_user(user_id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Only accounts already registered with Google retain access. New accounts have no row and wait.
INSERT INTO wgh.wgh_video_access(user_id,approved)
SELECT DISTINCT user_id,true FROM wgh.wgh_google_identity;
ALTER TABLE wgh.wgh_video_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON wgh.wgh_video_access FROM PUBLIC,anon,authenticated;
COMMIT;
