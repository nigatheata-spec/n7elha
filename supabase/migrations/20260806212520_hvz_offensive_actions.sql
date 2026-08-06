-- Humans vs Zombies: offensive power-ups (instant damage, cash steal, income
-- debuff, drain overclock). Rather than adding a narrow column per mechanic,
-- these vary enough (different targets/durations/payloads) that a single
-- flexible payload column is a cleaner fit than five more single-purpose ones.
ALTER TABLE hvz_actions
  ADD COLUMN IF NOT EXISTS effect JSONB NOT NULL DEFAULT '{}';
