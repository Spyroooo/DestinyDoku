-- Keep existing daily data intact. A practice run can count only once across ALL days.
CREATE TABLE IF NOT EXISTS practice_completions (
  run_hash TEXT PRIMARY KEY NOT NULL,
  day_key TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS practice_totals (
  day_key TEXT PRIMARY KEY NOT NULL,
  completions INTEGER NOT NULL DEFAULT 0 CHECK (completions >= 0)
);

CREATE TRIGGER IF NOT EXISTS count_practice_completion
AFTER INSERT ON practice_completions
BEGIN
  INSERT INTO practice_totals (day_key, completions)
  VALUES (NEW.day_key, 1)
  ON CONFLICT (day_key) DO UPDATE SET completions = completions + 1;
END;
