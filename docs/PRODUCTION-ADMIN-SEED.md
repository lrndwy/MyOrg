# Seed Admin di Production

Panduan ini menjelaskan cara membuat **akun admin pertama** dan data awal MyOrg (permissions, role Admin, org settings, dll.) di environment **production** — aman, tanpa password dev `admin123`.

## Prasyarat

1. PostgreSQL production sudah jalan dan `.env` server sudah benar (`POSTGRES_*` atau `DATABASE_URL`, `APP_ENV=production`).
2. Migrasi schema sudah dijalankan (`grit migrate` atau binary `./migrate`).
3. Anda punya akses shell ke server / container API (SSH atau `docker exec`).

## Variabel environment wajib

Di `.env` production ( **jangan commit** password ke Git):

```bash
APP_ENV=production

# Wajib saat seed admin di production — seeder menolak password default "admin123"
SEED_ADMIN_PASSWORD=<password-kuat-min-12-karakter>
```

Generator password aman:

```bash
openssl rand -base64 24
```

Tambahkan baris `SEED_ADMIN_PASSWORD` ke `.env.example` hanya sebagai dokumentasi (tanpa nilai asli) — lihat file `.env.example` di repo.

## Apa yang di-seed?

Perintah `grit seed` / `./seed` menjalankan (idempotent — aman dijalankan ulang):

| Urutan | Isi |
|--------|-----|
| 1 | User admin Grit (`Role=ADMIN`) jika belum ada |
| 2 | Semua `permissions`, role aplikasi **Admin** (+ Bendahara), org settings, kategori surat & keuangan, divisi demo |
| 3 | Link admin ke AppRole Admin + divisi **Umum** |

**Tidak** di-seed di production: user demo (`jane@example.com`, dll.) — otomatis dilewati jika `APP_ENV=production`.

### Akun admin default

| Field | Nilai |
|-------|--------|
| Username (login) | `admin` |
| Email | `admin@example.com` |
| Password | nilai `SEED_ADMIN_PASSWORD` |
| Grit role | `ADMIN` (akses admin panel `:3001`) |
| App role | **Admin** (semua permission bisnis) |

Login terpusat di **Web** (`NEXT_PUBLIC_WEB_URL`), lalu buka Admin panel. Ganti email/password admin setelah login pertama jika diperlukan (via menu Users di admin).

## Langkah — API jalan di host (VPS, tanpa Docker app)

Dari root repo, dengan `.env` production ter-load:

```bash
# 1. Migrasi (sekali deploy / setelah update model)
grit migrate

# 2. Seed — password admin dari env, bukan admin123
export SEED_ADMIN_PASSWORD='password-rahasia-anda'
grit seed
```

Alternatif tanpa Grit CLI:

```bash
cd apps/api
export SEED_ADMIN_PASSWORD='password-rahasia-anda'
export APP_ENV=production
# Pastikan DATABASE_URL / POSTGRES_* sudah di env
go run ./cmd/seed
```

## Langkah — stack Docker (`docker-compose.prod.yml`)

Pastikan `SEED_ADMIN_PASSWORD` ada di `.env` di host (dibaca `env_file` service `api`).

```bash
# Migrasi
docker compose -f docker-compose.prod.yml exec api ./migrate

# Seed admin + data MyOrg
docker compose -f docker-compose.prod.yml exec api ./seed
```

Atau one-off container (mis. API belum running):

```bash
docker compose -f docker-compose.prod.yml run --rm api ./seed
```

Setelah sukses, log API/container akan menampilkan:

```text
Created admin user: admin@example.com (password from SEED_ADMIN_PASSWORD)
```

Jika admin sudah pernah dibuat:

```text
Admin user already exists, skipping...
```

Permission/role tetap disinkronkan — seed ulang tidak menghapus data user.

## Troubleshooting

### `refusing to seed the default admin in production`

`SEED_ADMIN_PASSWORD` kosong sementara `APP_ENV=production`. Set password kuat di env lalu jalankan seed lagi.

### Admin sudah ada tapi lupa password

Seed **tidak** mengubah password user yang sudah ada. Opsi:

1. Reset lewat admin lain (Users → edit), atau
2. Reset manual di DB (hash bcrypt) — hanya jika tidak ada admin lain, atau
3. Hapus baris user `admin@example.com` (hati-hati, production) lalu jalankan seed lagi dengan `SEED_ADMIN_PASSWORD` baru.

### `relation ... does not exist`

Jalankan migrasi dulu: `grit migrate` atau `./migrate`.

### Jangan pakai di production

```bash
grit migrate --fresh   # DROP semua data
```

## Checklist deploy production

- [ ] `APP_ENV=production`
- [ ] `JWT_SECRET` / `JWT_REFRESH_SECRET` di-rotasi (bukan nilai dev)
- [ ] `SEED_ADMIN_PASSWORD` kuat, hanya di `.env` server
- [ ] `grit migrate` sukses
- [ ] `grit seed` sukses
- [ ] Login web: username `admin` + password dari `SEED_ADMIN_PASSWORD`
- [ ] Buka admin panel, verifikasi permission & ganti kredensial default jika perlu
- [ ] Hapus / unset `SEED_ADMIN_PASSWORD` dari env runtime API setelah seed (opsional, mengurangi risiko bocor) — simpan password di password manager

## Referensi kode

- Admin user: `apps/api/internal/database/users_seeder.go` (`seedAdminUser`)
- Permissions & role: `apps/api/internal/database/myorg_seeder.go`
- Entrypoint: `apps/api/cmd/seed/main.go`, perintah CLI `grit seed`
