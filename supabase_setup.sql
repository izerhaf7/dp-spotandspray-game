-- ============================================================
-- SPOT & SPRAY — Supabase Setup
-- ============================================================
-- Cara pakai:
--   1. Buka Supabase Dashboard → SQL Editor
--   2. Copy-paste SELURUH isi file ini
--   3. Klik "Run"
--   4. Selesai! Tabel & policy langsung aktif.
-- ============================================================

-- 1. Buat tabel leaderboard
CREATE TABLE IF NOT EXISTS leaderboard (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 16),
  score      INT NOT NULL DEFAULT 0,
  accuracy   NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Index untuk query top skor (ORDER BY score DESC)
CREATE INDEX IF NOT EXISTS idx_leaderboard_score
  ON leaderboard (score DESC);

-- 3. Aktifkan Row Level Security
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

-- 4. Policy: siapa saja boleh INSERT (tanpa login, pakai anon key)
CREATE POLICY "Siapa saja boleh submit skor"
  ON leaderboard
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- 5. Policy: siapa saja boleh SELECT (baca leaderboard)
CREATE POLICY "Siapa saja boleh lihat leaderboard"
  ON leaderboard
  FOR SELECT
  TO anon
  USING (true);

-- 6. (Opsional) Aktifkan Realtime untuk live update di proyektor
ALTER PUBLICATION supabase_realtime ADD TABLE leaderboard;

-- ============================================================
-- Selesai! Sekarang ambil kredensial dari Supabase Dashboard:
--   Settings → API → Project URL & anon public key
-- Lalu paste ke game.js baris 7-8:
--   const SUPABASE_URL = 'https://xxxxx.supabase.co';
--   const SUPABASE_ANON_KEY = 'eyJhbGciOiJI...';
-- ============================================================
