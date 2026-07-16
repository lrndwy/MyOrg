# AGENTS.md — MyOrganizations System

Panduan ini untuk **AI coding agent** apa pun (Claude Code, Cursor, Copilot Workspace, dll.) yang mengerjakan repo ini. Baca file ini penuh sebelum membuat perubahan. Untuk detail arsitektur & skema data, baca [`DESIGN.md`](DESIGN.md). Untuk instruksi khusus Claude Code, baca [`CLAUDE.md`](CLAUDE.md). Requirement produk: [`PRD.md`](PRD.md).

## 1. Ringkasan Project

MyOrg System adalah aplikasi manajemen organisasi (user, role & access, divisi, event, absensi, perizinan, pelanggaran/SP, open recruitment, surat masuk/keluar, announcement). Dibangun di atas **Grit Framework** (Go + Gin + GORM di backend, Next.js App Router di frontend, admin panel terpisah).

Referensi requirement lengkap ada di `PRD.md` (alur fitur, input/output, schema, endpoint contoh).

## 2. Tech Stack

| Layer | Teknologi |
|---|---|
| Backend | Go 1.21+, Gin, GORM |
| Frontend Web | Next.js (App Router) |
| Admin Panel | Next.js (generated admin app dari Grit `--triple`) |
| Styling | Tailwind CSS + shadcn/ui (Grit UI) |
| Database | PostgreSQL (dev via Docker) |
| Cache/Queue | Redis + `asynq` (background jobs, cron) |
| File Storage | S3-compatible (MinIO lokal, R2/S3 di production) — untuk foto selfie, tanda tangan, lampiran surat, lampiran pengumuman, dsb. |
| Email | Resend (notifikasi approval izin, hasil import user, dsb.) |
| Auth | JWT + refresh token, opsional 2FA (TOTP) |
| Validasi | Zod (di-generate otomatis dari model Go via `grit sync`) |
| Data Fetching | TanStack Query (hook di-generate otomatis) |
| Monorepo | Turborepo + pnpm |
| Observability | Pulse (`/pulse/ui`), Sentinel WAF (`/sentinel/ui`) |
| DB Browser | GORM Studio (`/studio`) |
| API Docs | Scalar / gin-docs, auto-generate di `/docs` |

Arsitektur yang dipakai: **Triple mode** (`grit new . --triple --next`) → Web + Admin + API dalam satu monorepo Turborepo.

## 3. Setup & Menjalankan Project

```bash
# instalasi CLI (sekali saja, biasanya sudah tersedia di environment)
go install github.com/MUKE-coder/grit/v3/cmd/grit@latest

# jalankan service pendukung (Postgres, Redis, MinIO, Mailhog)
docker compose up -d

# install dependency & jalankan dev server (web + admin + api paralel)
pnpm install
pnpm dev
# atau granular:
grit start server      # hanya Go API
grit start client       # hanya frontend apps

# migrasi & seed database
grit migrate
grit seed
```

Web: `http://localhost:3000` · Admin: `http://localhost:3001` (cek `pnpm dev` log untuk port pasti) · API: `http://localhost:8080` · API docs: `http://localhost:8080/docs` · DB Studio: `http://localhost:8080/studio`.

## 4. Struktur Project (Triple Mode)

```
apps/
  api/                 # Go (Gin + GORM)
    cmd/               # server, migrate, seed, backup
    internal/          # models, services, handlers, routes, middleware, jobs, database
  web/                 # Next.js — halaman untuk user umum
  admin/               # Next.js — halaman untuk admin/role berizin
packages/
  shared/              # Zod schemas + TypeScript types (hasil grit sync) + brand/themes
PRD.md                 # Product requirements
DESIGN.md              # Arsitektur & resource mapping
AGENTS.md              # Panduan AI agent (dokumen ini)
CLAUDE.md              # Instruksi khusus Claude Code
```

Di dalam `apps/api/internal`, setiap resource punya konsistensi: `models/`, `services/`, `handlers/`, `routes/` — digenerate lewat `grit generate resource`, jangan dibuat manual dari nol.

## 5. Alur Kerja Wajib: Gunakan Code Generator

**Aturan utama:** untuk setiap entity baru di `DESIGN.md` (User, Role, Division, Event, Attendance, PermissionRequest, Violation, Recruitment, Letter, Announcement, dst.), **selalu mulai dari `grit generate resource`**, jangan menulis model/handler/route secara manual dari kosong.

```bash
# contoh generate resource Division
grit generate resource Division --fields "name:string,description:text"

# contoh generate resource Event dengan relasi ke Division
grit generate resource Event --fields "title:string,description:text,location:string,startTime:datetime,endTime:datetime,allowPermission:bool,status:string,division:belongs_to:Division"

# mode interaktif jika field kompleks
grit generate resource Attendance -i

# setelah ubah struct Go apa pun secara manual, selalu sinkronkan tipe FE
grit sync
```

Setelah generate:
1. **Jangan** hapus/pindahkan marker komentar (`// grit:inject...`) yang disisipkan generator — dipakai untuk auto-wiring routes/admin page.
2. Tambahkan business logic tambahan (validasi custom, permission check, side effect) di layer **service**, bukan di **handler**.
3. Jalankan `grit sync` setiap selesai mengubah field model Go agar Zod schema & TypeScript hook FE tetap sinkron.
4. Untuk menghapus resource yang salah generate: `grit remove resource <Name>` (jangan hapus file manual, supaya route injection ikut ter-reverse).

## 6. Konvensi Kode

### Go (`apps/api`)
- Nama file & package mengikuti konvensi Grit generator (lowercase, singular untuk model: `event.go`, `attendance.go`).
- Service layer memegang business logic; handler hanya orchestrate request/response + validasi input dasar.
- Semua akses data lewat GORM repository/service, jangan raw SQL kecuali benar-benar perlu (report kompleks, index tuning).
- Gunakan `uuid` sebagai PK sesuai `DESIGN.md`, bukan auto-increment int.
- Error response konsisten: `{ "success": false, "message": "...", "errors": {...} }` (lihat contoh di PRD §5).

### TypeScript/React (`apps/web`, `apps/admin`)
- Gunakan hook TanStack Query hasil generate (`packages/shared` + generated hooks), jangan `fetch` manual berulang.
- Komponen form pakai Grit UI (shadcn-compatible) agar konsisten dengan admin panel.
- Validasi form pakai Zod schema yang sama dengan backend (single source of truth di `packages/shared`).

### Permission & Role
- Grit built-in role (`ADMIN` / `EDITOR` / `USER`) dipakai hanya sebagai **tingkat akses dasar ke framework** (admin panel access gate).
- Role & permission **dinamis** sesuai requirement PRD (`roles`, `permissions`, `role_permissions`) diimplementasikan sebagai resource aplikasi sendiri — lihat `DESIGN.md` §4 untuk detail middleware permission check-nya. Jangan hardcode permission check dengan role string; selalu cek lewat permission code (mis. `events.create`).

## 7. Testing, Lint, Build

```bash
# backend
cd apps/api && go test ./...
cd apps/api && go vet ./...

# frontend
pnpm lint
pnpm typecheck
pnpm build

# routes sanity check setelah generate resource baru
grit routes
```

**Wajib dijalankan sebelum menganggap task selesai:**
1. `grit sync` (jika ada perubahan model)
2. `go vet ./...` & `go test ./...` di `apps/api`
3. `pnpm lint` & `pnpm typecheck` di root
4. `grit routes` untuk memastikan endpoint baru benar-benar terdaftar

## 8. Environment Variables

Salin `.env.example` → `.env` di `apps/api` dan masing-masing app frontend. Variabel penting:
- `DATABASE_URL` (Postgres)
- `REDIS_URL`
- `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` (MinIO di dev)
- `RESEND_API_KEY`
- `JWT_SECRET`, `JWT_REFRESH_SECRET`

Jangan pernah commit `.env` berisi secret asli. Agent tidak boleh menulis nilai secret baru ke file yang di-commit.

## 9. Git & Commit Convention

- Commit message: `<type>(<scope>): <deskripsi singkat>` — type: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`. Scope = nama resource/module, mis. `feat(events): tambah endpoint recap absensi`.
- Satu resource/feature per PR sebisa mungkin, agar review lebih mudah.
- Jangan commit file hasil build (`.next/`, `dist/`, `bin/`).

## 10. Do's & Don'ts untuk AI Agent

**Do:**
- Selalu cek `PRD.md` dan `DESIGN.md` dulu sebelum implementasi fitur baru.
- Gunakan `grit generate resource` sebagai starting point, lalu kustomisasi.
- Jalankan `grit sync` setiap kali struct Go model berubah.
- Tulis test minimal untuk service layer yang berisi business logic penting (mis. approval perizinan, generate kode surat).

**Don't:**
- Jangan menulis ulang boilerplate CRUD yang seharusnya digenerate.
- Jangan mengedit kode di antara marker `// grit:inject` secara manual tanpa memahami efeknya ke `grit remove`.
- Jangan hardcode nilai konfigurasi (URL, secret, bucket name) di source code — selalu lewat env var.
- Jangan membuat migration manual di luar alur GORM AutoMigrate/`grit migrate` kecuali untuk kasus khusus (index, constraint kompleks) yang didokumentasikan di `DESIGN.md`.
