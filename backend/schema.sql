CREATE DATABASE IF NOT EXISTS blackjack;
USE blackjack;

CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(20)  NOT NULL UNIQUE,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password      VARCHAR(255) NOT NULL,
  balance       INT          NOT NULL DEFAULT 1000,
  wins          INT          NOT NULL DEFAULT 0,
  losses        INT          NOT NULL DEFAULT 0,
  pushes        INT          NOT NULL DEFAULT 0,
  blackjacks    INT          NOT NULL DEFAULT 0,
  total_hands   INT          NOT NULL DEFAULT 0,
  total_wagered INT          NOT NULL DEFAULT 0,
  total_won     INT          NOT NULL DEFAULT 0,
  biggest_win   INT          NOT NULL DEFAULT 0,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);
