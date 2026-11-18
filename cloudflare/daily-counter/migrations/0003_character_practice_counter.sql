-- Daily totals already include a game key. Keep character practice separate
-- without rewriting or resetting any existing Weapons completion data.
CREATE TABLE IF NOT EXISTS character_practice_completions (
  run_hash TEXT PRIMARY KEY NOT NULL,
  day_key TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS character_practice_totals (
  day_key TEXT PRIMARY KEY NOT NULL,
  completions INTEGER NOT NULL DEFAULT 0 CHECK (completions >= 0)
);
CREATE TRIGGER IF NOT EXISTS count_character_practice_completion
AFTER INSERT ON character_practice_completions
BEGIN
  INSERT INTO character_practice_totals (day_key, completions)
  VALUES (NEW.day_key, 1)
  ON CONFLICT (day_key) DO UPDATE SET completions = completions + 1;
END;
