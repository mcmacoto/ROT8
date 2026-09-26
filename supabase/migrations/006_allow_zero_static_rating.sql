-- Migration 006: Allow static_rating 0.0 (Unrated) for players
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_static_rating_check;
ALTER TABLE players ADD CONSTRAINT players_static_rating_check 
  CHECK (static_rating IN (0.0, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0));
