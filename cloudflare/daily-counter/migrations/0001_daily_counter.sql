CREATE TABLE IF NOT EXISTS daily_completions (
  game TEXT NOT NULL,
  day_key TEXT NOT NULL,
  browser_hash TEXT NOT NULL,
  PRIMARY KEY (game, day_key, browser_hash)
);

CREATE TABLE IF NOT EXISTS daily_totals (
  game TEXT NOT NULL,
  day_key TEXT NOT NULL,
  completions INTEGER NOT NULL DEFAULT 0 CHECK (completions >= 0),
  PRIMARY KEY (game, day_key)
);

-- Increment only when a new completion is inserted, atomically with that insert.
-- Duplicate retries never fire this trigger. Reading the total is constant-cost.
CREATE TRIGGER IF NOT EXISTS count_daily_completion
AFTER INSERT ON daily_completions
BEGIN
  INSERT INTO daily_totals (game, day_key, completions)
  VALUES (NEW.game, NEW.day_key, 1)
  ON CONFLICT (game, day_key) DO UPDATE SET completions = completions + 1;
END;
