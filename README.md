# 🎮 Spot & Spray

**Mini-game edukatif untuk pameran** — simulasi AI drone pemantauan kesehatan kelapa sawit.

Pemain berperan sebagai "operator AI" yang harus cepat memvalidasi hasil deteksi drone: **tap pohon sakit**, **biarkan pohon sehat**, dalam 45 detik.

## ✨ Fitur

- 🌴 **Pixel art playful** — dunia kebun gaya Stardew Valley
- 🤖 **Drone serius & teknikal** — maskot proyek yang kredibel
- 🎯 **3 fase kesulitan** — makin cepat & makin banyak sinyal
- 🔥 **Sistem combo** — 5 tap benar berturut-turut = x1.5 multiplier
- 📊 **Confusion matrix** — breakdown akurasi ala machine learning
- 🏆 **Leaderboard real-time** — via Supabase, parallel-safe
- 📱 **Mobile-first** — optimasi untuk HP via QR code

## 🚀 Setup

### 1. Jalankan Lokal (Development)

```bash
# Pakai static server apapun, contoh:
npx serve .

# Atau buka index.html langsung di browser
```

### 2. Setup Supabase (Leaderboard)

1. Buat project di [supabase.com](https://supabase.com) (free tier)
2. Buat tabel `leaderboard`:
   ```sql
   CREATE TABLE leaderboard (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     name TEXT NOT NULL,
     score INT NOT NULL,
     accuracy NUMERIC,
     created_at TIMESTAMPTZ DEFAULT now()
   );
   ```
3. Aktifkan Row Level Security, tambah policy:
   ```sql
   -- Izinkan insert publik (tanpa login)
   CREATE POLICY "Allow public insert" ON leaderboard
     FOR INSERT TO anon WITH CHECK (true);
   
   -- Izinkan select publik
   CREATE POLICY "Allow public select" ON leaderboard
     FOR SELECT TO anon USING (true);
   ```
4. Copy **Project URL** dan **Anon Key** dari Supabase Dashboard
5. Paste ke `game.js` baris 7-8:
   ```js
   const SUPABASE_URL = 'https://xxxxx.supabase.co';
   const SUPABASE_ANON_KEY = 'eyJhbGciOiJI...';
   ```

### 3. Deploy

Deploy ke **Vercel** atau **Netlify** (free tier):
- Drag-drop folder project → langsung dapat URL HTTPS publik
- Generate QR code dari URL final tersebut

## 📁 Struktur File

```
├── index.html    # Halaman utama (4 layar: Start, Game, Result, Leaderboard)
├── style.css     # Styling mobile-first, dual visual system
├── sprites.js    # Pixel art sprite generator (procedural)
├── audio.js      # Sound effects via Web Audio API (tanpa file audio)
├── game.js       # Core game logic, scoring, Supabase integration
└── README.md
```

## 🎮 Cara Main

1. Tap **MULAI** → countdown 3-2-1-GO
2. Perhatikan grid 5×4 — pohon sawit akan menampilkan sinyal:
   - ☠ **Sakit** (merah/oranye) → **Tap!** → +10 poin
   - ✦ **Sehat** (hijau) → **Jangan tap!** → -5 jika salah tap
   - ? **Ambigu** (kuning) → 50% benar (+5) / 50% salah (-2)
3. **Combo**: 5 tap benar berturut-turut = multiplier x1.5
4. Setelah 45 detik → lihat breakdown akurasi → simpan skor

## 📋 Checklist Pra-Pameran

- [ ] Deploy ke domain final, generate QR dari URL tersebut
- [ ] Test di beberapa HP (Android & iOS, Chrome & Safari)
- [ ] Test submit skor dari banyak device bersamaan
- [ ] Cek WiFi venue — siapkan hotspot cadangan
- [ ] Siapkan tablet/proyektor untuk papan skor publik
