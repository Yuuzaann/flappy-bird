# 🐦 Flappy Bird — Reborn

Versi ulang dari game Flappy Bird klasik berbasis HTML, CSS, dan JavaScript murni (tanpa framework, tanpa dependency). Dibangun ulang dari proyek awal dengan perbaikan bug, physics berbasis delta-time, sistem audio tanpa delay, dan UI yang lebih matang.

![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?logo=javascript&logoColor=black)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![No dependencies](https://img.shields.io/badge/dependencies-none-success)

## Demo

Buka `index.html` langsung di browser — tidak perlu build step atau server (kecuali untuk audio autoplay di beberapa browser, lihat [Menjalankan Secara Lokal](#menjalankan-secara-lokal)).

## Fitur

- **Physics berbasis delta-time** — kecepatan gerak burung dan pipa konsisten di refresh rate layar berapa pun (60Hz, 120Hz, dst), bukan diasumsikan tetap 60fps.
- **Audio tanpa delay** — semua efek suara di-*preload* dan memakai audio pool (beberapa instance yang bergantian dipakai) sehingga bisa tumpang tindih tanpa jeda maupun saling memotong.
- **Skor terbaik tersimpan** — memakai `localStorage`, bertahan walau tab ditutup.
- **Kesulitan dinamis** — kecepatan pipa naik bertahap seiring skor, dengan batas atas agar tetap bisa dimainkan.
- **Kontrol lengkap** — keyboard (`Spasi` / `↑` / `Enter`), klik, dan sentuh (mobile-friendly).
- **Jeda & mute** — tombol jeda (`⏸` atau `P`) dan bisukan suara (`🔊`), keduanya tetap berfungsi mulus di tengah permainan.
- **Rotasi burung** — burung miring mengikuti kecepatan jatuh/naik untuk kesan gerak yang lebih hidup.
- **Layar start & game over** yang rapi, lengkap dengan indikator rekor baru.
- **Hitbox yang adil** — area tabrakan burung sedikit lebih kecil dari sprite-nya agar tabrakan terasa masuk akal, bukan menghukum pemain karena pixel transparan.
- **Sepenuhnya responsif** — menyesuaikan ukuran layar desktop maupun mobile.

## Struktur Proyek

```
flappy-bird/
├── index.html          # Markup halaman & struktur UI (HUD, overlay start/pause/game over)
├── style.css            # Seluruh styling, animasi, dan layout responsif
├── script.js             # Logika game: physics, tabrakan, skor, audio, kontrol
├── images/
│   ├── background.gif   # Latar belakang animasi
│   ├── bird.png          # Sprite burung — posisi normal
│   └── bird2.png         # Sprite burung — posisi mengepak
└── sounds/
    ├── point.mp3          # Efek suara saat melewati pipa
    ├── gameover.mp3    # Efek suara saat game over
    └── lagu.mp3           # Musik latar (loop)
```

## Menjalankan Secara Lokal

Cara termudah, cukup buka `index.html` di browser modern (Chrome, Firefox, Edge, Safari).

Jika browser membatasi pemutaran audio dari file lokal (`file://`), jalankan lewat server statis sederhana:

```bash
# Python 3
python3 -m http.server 8000

# atau Node.js
npx serve .
```

Lalu buka `http://localhost:8000` di browser.

## Cara Bermain

| Aksi | Kontrol |
|---|---|
| Mulai / Terbang | `Spasi`, `↑`, klik, atau ketuk layar |
| Mulai cepat | `Enter` |
| Jeda / Lanjut | `P`, `Esc`, atau tombol ⏸ |
| Bisukan suara | Tombol 🔊 |

Hindari pipa, kumpulkan skor sebanyak mungkin, dan kalahkan rekor terbaikmu sendiri.

## Detail Teknis

### Game loop

Loop utama berjalan lewat `requestAnimationFrame` dan menghitung `deltaTime` antar frame, sehingga seluruh nilai kecepatan (gravitasi, kecepatan pipa, dorongan lompat) dinyatakan dalam satuan **per detik**, bukan per frame. Ini menghindarkan game dari berjalan terlalu cepat/lambat di perangkat dengan refresh rate berbeda.

### Sistem audio

Efek suara (`point`, `gameover`) menggunakan pola **audio pool**: beberapa instance `<audio>` yang sudah dipanggil `.load()` di awal, lalu dipakai bergantian saat efek dipicu. Ini menghilangkan dua masalah umum pada implementasi naif:

1. **Delay saat pertama diputar** — karena audio sudah di-*preload* sejak game dimuat.
2. **Suara terpotong saat dipicu berkali-kali cepat** — karena tiap pemicu memakai instance yang berbeda dari instance sebelumnya, bukan me-restart satu instance yang sama.

### Deteksi tabrakan

Tabrakan dicek dengan membandingkan bounding box burung (yang sedikit diperkecil lewat `HITBOX_SHRINK`) terhadap bounding box tiap pipa aktif, dan skor bertambah berdasarkan flag `scored` per pasang pipa — bukan menebak posisi tiap frame — sehingga tidak pernah menghitung dobel atau melewatkan skor.

## Kredit

- Sprite burung & latar belakang: aset dari proyek Flappy Bird open-source.
- Dikembangkan ulang dan diperbaiki dengan bantuan Claude (Anthropic).

## Lisensi

Bebas digunakan dan dimodifikasi untuk keperluan belajar maupun non-komersial. Sertakan atribusi jika dibagikan ulang.
