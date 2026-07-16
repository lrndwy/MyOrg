# CLAUDE.md — MyOrganizations System

Instruksi ini khusus untuk Claude Code saat bekerja di repo ini. Aturan umum lintas-agent ada di [`AGENTS.md`](AGENTS.md); arsitektur & pemetaan resource ada di [`DESIGN.md`](DESIGN.md); requirement produk ada di [`PRD.md`](PRD.md). **Baca ketiganya sebelum mengerjakan task apa pun** — `AGENTS.md` dan `DESIGN.md` tetap berlaku penuh, dokumen ini hanya menambahkan hal spesifik cara Claude Code bekerja.

## 1. Cara Memulai Setiap Sesi

1. Baca `PRD.md` untuk fitur yang relevan dengan task.
2. Baca `DESIGN.md` bagian resource mapping yang terkait sebelum generate apa pun.
3. Jalankan `grit routes` untuk melihat state route saat ini sebelum menambah endpoint baru, agar tidak duplikat.
4. Jika task menyentuh model yang sudah ada, baca file model Go-nya dulu (`apps/api/internal/models/*.go`) — jangan asumsikan struktur field dari ingatan/percakapan sebelumnya.

## 2. Alat & Perintah yang Boleh Dijalankan Bebas (read-only / aman)

Claude Code boleh menjalankan ini tanpa konfirmasi tambahan:
```bash
grit routes
grit version
go vet ./...
go test ./...
pnpm lint
pnpm typecheck
git status / git diff / git log
```

## 3. Alat yang Butuh Perhatian Ekstra (destruktif / mengubah state)

Konfirmasi dengan pengguna dulu sebelum menjalankan, atau jelaskan efeknya di respons sebelum eksekusi:
```bash
grit migrate --fresh     # drop seluruh data + re-migrate
grit remove resource X   # menghapus file & reverse route injection
grit down                # maintenance mode, memutus akses user ke aplikasi
grit deploy ...          # deploy ke server
docker compose down -v   # menghapus volume DB lokal
```
Jangan pernah menjalankan perintah di atas terhadap environment yang terindikasi production (cek `.env` / nama host sebelum eksekusi apa pun yang destruktif).

## 4. Alur Kerja Standar untuk Task "Tambah Fitur Baru"

1. Cek `DESIGN.md` §2 — apakah resource sudah dipetakan? Jika belum, tambahkan pemetaan field ke `DESIGN.md` dulu (dokumen ini harus tetap jadi source of truth), baru generate.
2. `grit generate resource <Name> --fields "..."` sesuai spesifikasi.
3. Tambahkan business logic non-trivial di service layer (`apps/api/internal/services/`), bukan handler.
4. Jika ada permission baru yang belum ada di daftar (`DESIGN.md` §4), tambahkan ke seed permission.
5. `grit sync` untuk update Zod schema & TS types di `packages/shared`.
6. Implementasi UI di `apps/web` (user-facing) dan/atau `apps/admin` (admin-facing) sesuai sitemap PRD §6, pakai hook TanStack Query hasil generate.
7. Jalankan verifikasi (§6 di bawah) sebelum melaporkan task selesai.

## 5. Batasan File & Direktori

- **Jangan edit** file di dalam blok `// grit:inject:start ... // grit:inject:end` secara manual kecuali memang sedang menambah entri baru sesuai pola yang sudah ada di situ (mis. menambah satu baris route baru mengikuti pola existing) — jangan menghapus/mengubah marker itu sendiri.
- **Jangan edit** output `grit sync` di `packages/shared/` secara manual — edit source-nya (struct Go) lalu jalankan sync ulang.
- **Jangan** commit `.env`, folder `node_modules/`, `.next/`, atau binary hasil build Go.
- File dokumentasi (`PRD.md`, `DESIGN.md`, `AGENTS.md`, `CLAUDE.md`) adalah living document — update jika ada keputusan desain baru yang diambil selama development, jangan biarkan out-of-sync dengan kode.

## 6. Definition of Done — Checklist Sebelum Menutup Task

Sebelum menyatakan sebuah task selesai ke pengguna, Claude Code harus sudah:
- [ ] `grit sync` dijalankan (jika ada perubahan model)
- [ ] `go vet ./...` dan `go test ./...` lulus tanpa error di `apps/api`
- [ ] `pnpm lint` dan `pnpm typecheck` lulus di root monorepo
- [ ] `grit routes` menunjukkan endpoint baru terdaftar dengan benar (kalau task menambah endpoint)
- [ ] Permission check terpasang di route yang butuh proteksi (bandingkan ke daftar permission `DESIGN.md` §4)
- [ ] Perubahan skema/keputusan desain penting sudah direfleksikan balik ke `DESIGN.md` jika menyimpang dari rencana awal

Jika salah satu poin gagal dan tidak bisa diperbaiki dalam sesi ini, laporkan secara eksplisit ke pengguna alih-alih diam-diam melewatkannya.

## 7. Gaya Komunikasi saat Melapor ke Pengguna

- Ringkas: sebutkan resource/fitur apa yang diimplementasikan, command generator yang dipakai, file kunci yang diubah/dibuat, dan hasil verifikasi (§6).
- Jika ada penyimpangan dari `DESIGN.md` (misal field tambahan yang ternyata dibutuhkan), sebutkan secara eksplisit sebagai keputusan yang diambil, bukan disembunyikan di dalam diff.
- Jika sebuah requirement di PRD ambigu terhadap kapabilitas Grit (misal: field type yang tidak didukung generator), jelaskan trade-off yang diambil dan alasannya — jangan diam-diam menyederhanakan requirement.

## 8. Hal yang Sering Salah (Hindari)

- Menulis handler CRUD manual padahal seharusnya lewat `grit generate resource`.
- Lupa `grit sync` setelah ubah struct Go → FE jadi pakai tipe basi.
- Meletakkan business logic (approval, counter surat, cron transisi status) di handler, bukan service — menyulitkan testing.
- Menggunakan role string (`"Admin"`) langsung untuk gating fitur, padahal seharusnya cek permission code (`RequirePermission("events.create")`) sesuai model RBAC di `DESIGN.md` §4.
- Menyimpan file upload (selfie, signature, lampiran) langsung sebagai base64 di kolom DB alih-alih upload ke S3/MinIO dan simpan URL saja.
