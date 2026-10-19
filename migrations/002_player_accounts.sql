-- Additive migration. Apply to an explicitly selected database only.
CREATE TABLE wgh_player_account (
    player_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    linked_by BIGINT NULL,
    linked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (player_id),
    UNIQUE KEY uq_wgh_player_account_user (user_id),
    CONSTRAINT fk_wgh_player_account_player FOREIGN KEY (player_id) REFERENCES futsal_player(player_id),
    CONSTRAINT fk_wgh_player_account_user FOREIGN KEY (user_id) REFERENCES app_user(user_id),
    CONSTRAINT fk_wgh_player_account_admin FOREIGN KEY (linked_by) REFERENCES app_user(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
