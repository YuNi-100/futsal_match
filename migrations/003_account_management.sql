-- Add only; apply to the reviewed test database first.
CREATE TABLE wgh_account_consent (
 user_id BIGINT NOT NULL PRIMARY KEY,
 terms_version VARCHAR(30) NOT NULL,
 privacy_version VARCHAR(30) NOT NULL,
 accepted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (user_id) REFERENCES app_user(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE wgh_admin_request (
 request_id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 user_id BIGINT NOT NULL,
 reason VARCHAR(1000) NOT NULL,
 status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
 requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 reviewed_by BIGINT NULL,
 review_note VARCHAR(1000) NULL,
 reviewed_at TIMESTAMP NULL,
 INDEX ix_wgh_admin_request_user (user_id,status),
 FOREIGN KEY (user_id) REFERENCES app_user(user_id),
 FOREIGN KEY (reviewed_by) REFERENCES app_user(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE wgh_role_history (
 history_id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 user_id BIGINT NOT NULL,
 actor_id BIGINT NOT NULL,
 action ENUM('approved','rejected','revoked') NOT NULL,
 note VARCHAR(1000) NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (user_id) REFERENCES app_user(user_id),
 FOREIGN KEY (actor_id) REFERENCES app_user(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
