-- Apply manually to the EXISTING WGH database after reviewing and backing it up.
-- Adds authentication tables only. Does not change existing tables or rows.
-- Run once. DDL in MySQL is not an atomic multi-statement transaction.
CREATE TABLE wgh_google_identity (
    google_sub VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    user_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (google_sub),
    UNIQUE KEY uq_wgh_google_user (user_id),
    CONSTRAINT fk_wgh_google_user FOREIGN KEY (user_id) REFERENCES app_user(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE wgh_user_role (
    user_id BIGINT NOT NULL,
    role ENUM('user','admin') NOT NULL DEFAULT 'user',
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    CONSTRAINT fk_wgh_role_user FOREIGN KEY (user_id) REFERENCES app_user(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE wgh_login_session (
    token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    user_id BIGINT NOT NULL,
    csrf_token VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    expires_at DATETIME NOT NULL,
    PRIMARY KEY (token_hash),
    KEY ix_wgh_session_expiry (expires_at),
    KEY ix_wgh_session_user (user_id),
    CONSTRAINT fk_wgh_session_user FOREIGN KEY (user_id) REFERENCES app_user(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE wgh_oauth_state (
    state_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    nonce VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    verifier VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    expires_at DATETIME NOT NULL,
    PRIMARY KEY (state_hash),
    KEY ix_wgh_oauth_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
