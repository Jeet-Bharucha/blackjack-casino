USE blackjack;

DROP PROCEDURE IF EXISTS add_col;
DELIMITER //
CREATE PROCEDURE add_col(IN tbl VARCHAR(64), IN col VARCHAR(64), IN col_def TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = tbl AND column_name = col
  ) THEN
    SET @s = CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN `', col, '` ', col_def);
    PREPARE stmt FROM @s;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END //
DELIMITER ;

CALL add_col('users', 'streak',           'INT NOT NULL DEFAULT 0');
CALL add_col('users', 'last_daily_bonus', 'DATE NULL');
CALL add_col('users', 'vip_tier',         "VARCHAR(20) NOT NULL DEFAULT 'Bronze'");
CALL add_col('users', 'win_streak',       'INT NOT NULL DEFAULT 0');
CALL add_col('users', 'max_win_streak',   'INT NOT NULL DEFAULT 0');
CALL add_col('users', 'display_name',       'VARCHAR(30) NULL');
CALL add_col('users', 'avatar',             'MEDIUMTEXT NULL');
CALL add_col('users', 'date_of_birth',      'DATE NULL');
CALL add_col('users', 'last_weekly_bonus',  'DATETIME NULL');
CALL add_col('users', 'is_admin',           'TINYINT(1) NOT NULL DEFAULT 0');
CALL add_col('users', 'is_banned',          'TINYINT(1) NOT NULL DEFAULT 0');
CALL add_col('users', 'referral_code',      'VARCHAR(10) NULL');
CALL add_col('users', 'referred_by',        'INT NULL');
CALL add_col('users', 'deposit_limit',      'INT NULL');
CALL add_col('users', 'self_excluded_until','DATETIME NULL');
CALL add_col('users', 'verify_status',      "VARCHAR(20) NOT NULL DEFAULT 'unverified'");
CALL add_col('users', 'id_document',        'LONGTEXT NULL');
CALL add_col('users', 'selfie_photo',       'LONGTEXT NULL');
CALL add_col('users', 'verified_at',        'DATETIME NULL');

DROP PROCEDURE IF EXISTS add_col;

CREATE TABLE IF NOT EXISTS achievements (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT         NOT NULL,
  achievement_key VARCHAR(50) NOT NULL,
  unlocked_at     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_achievement (user_id, achievement_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── New tables (v2) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS tournaments (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  type        ENUM('hourly','daily','weekly') NOT NULL DEFAULT 'daily',
  buy_in      INT NOT NULL DEFAULT 500,
  prize_pool  INT NOT NULL DEFAULT 0,
  starts_at   DATETIME NOT NULL,
  ends_at     DATETIME NOT NULL,
  status      ENUM('upcoming','active','ended') NOT NULL DEFAULT 'upcoming',
  max_players INT NOT NULL DEFAULT 100,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tournament_entries (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  tournament_id  INT NOT NULL,
  user_id        INT NOT NULL,
  starting_chips INT NOT NULL DEFAULT 1000,
  current_chips  INT NOT NULL DEFAULT 1000,
  hands_played   INT NOT NULL DEFAULT 0,
  joined_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_entry (tournament_id, user_id),
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)       REFERENCES users(id)       ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cosmetics (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  type        VARCHAR(30)  NOT NULL,
  key_name    VARCHAR(50)  NOT NULL,
  name        VARCHAR(100) NOT NULL,
  description VARCHAR(255),
  price       INT NOT NULL DEFAULT 100,
  UNIQUE KEY uq_cosmetic (type, key_name)
);

CREATE TABLE IF NOT EXISTS user_cosmetics (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  cosmetic_id  INT NOT NULL,
  purchased_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_equipped  TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_user_cosmetic (user_id, cosmetic_id),
  FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE,
  FOREIGN KEY (cosmetic_id) REFERENCES cosmetics(id) ON DELETE CASCADE
);

INSERT IGNORE INTO cosmetics (type, key_name, name, description, price) VALUES
('card_back','classic_red',   'Classic Red',    'The original red card back',              0),
('card_back','midnight_blue', 'Midnight Blue',  'Deep blue with gold trim',              500),
('card_back','emerald',       'Emerald',        'Luxury green felt pattern',             500),
('card_back','gold',          'Gold Royale',    'Shimmering 24K gold pattern',          1500),
('card_back','diamond',       'Diamond',        'Exclusive diamond-pattern card back',   3000),
('felt',     'green',         'Casino Green',   'Classic casino table felt',                0),
('felt',     'navy',          'Navy Blue',      'Elegant midnight navy felt',             750),
('felt',     'crimson',       'Crimson',        'Striking deep red felt',                 750),
('felt',     'black',         'Obsidian',       'Sleek all-black table',                 2000),
('felt',     'purple',        'Royal Purple',   'VIP royal purple table',                2000),
('chip',     'classic',       'Classic Chips',  'Standard casino chip design',              0),
('chip',     'neon',          'Neon Glow',      'Chips that glow in the dark',           1000),
('chip',     'gold',          'Gold Chips',     '24K gold plated chip design',           2500),
('chip',     'diamond',       'Diamond Chips',  'Crystal-clear diamond chip design',     5000);

SELECT 'Migration complete.' AS status;
