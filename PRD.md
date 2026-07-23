# PRD Detail — MyOrganizations System (MyOrg System)

Dokumen requirement produk. Keputusan arsitektur Grit ada di [`DESIGN.md`](DESIGN.md); panduan AI agent di [`AGENTS.md`](AGENTS.md) dan [`CLAUDE.md`](CLAUDE.md).

## 1. Overview

MyOrg System adalah Sistem Informasi Manajemen Organisasi berbasis web yang mendukung pengelolaan pengguna, role & akses, divisi, event & absensi, perizinan, pelanggaran/SP, open recruitment, surat masuk/keluar, dan pengumuman (announcement).

### 1.1 Actor / Role Dasar

| Actor | Deskripsi |
|---|---|
| **Super Admin / Admin** | Pengguna pertama saat sistem dijalankan. Memiliki akses penuh ke seluruh fitur, termasuk pengaturan sistem, manajemen role & akses. |
| **Role Kustom** (misal: Ketua Divisi, Sekretaris, Bendahara, Anggota) | Dibuat oleh Admin, hak akses diatur per fitur melalui modul Pengelolaan Role & Access. |
| **Pengguna Umum** | Setiap user yang login, minimal punya akses ke Profile, Events, Absensi. |

### 1.2 Konsep Permission

Setiap fitur memiliki sekumpulan **permission code** yang dapat di-assign ke Role. Contoh: `events.create`, `events.view`, `attendance.approve`, `letters.manage`, dst. Detail lengkap ada di bagian [4. Database Schema](#4-database-schema) tabel `permissions`.

---

## 2. Base Fitur

### 2.1 System Settings Organizations

**Halaman:** `/admin/settings`

**Deskripsi:** Halaman konfigurasi global organisasi. Hanya bisa diakses Admin/role dengan permission `settings.manage`.

**Alur:**
1. Admin membuka halaman Settings.
2. Sistem menampilkan form berisi konfigurasi saat ini (logo, icon, nama web, tema, rules).
3. Admin mengubah salah satu/semua field.
4. Admin klik Simpan → sistem validasi file (format & ukuran logo/icon) → update ke database & (jika perlu) upload ke storage.
5. Sistem menampilkan preview perubahan (misal tema baru langsung ter-apply di preview).

**Input:**
- `logo` (file: png/svg/jpg, max 2MB)
- `icon` (file: ico/png, max 512KB, disarankan 512x512)
- `web_name` (string, max 100 char)
- `theme` (enum, dipilih dari daftar tema/preset palette yang tersedia)
- `allow_self_register` (boolean)
- `allow_cross_division_events_view` (boolean)

**Output:**
- Konfirmasi sukses update
- Data settings terbaru yang langsung diterapkan ke seluruh sistem (favicon, branding, dsb.)

**Validasi/Catatan:**
- Perubahan tema harus dari daftar preset yang sudah didefinisikan (bukan custom color picker) sesuai requirement awal.
- `allow_self_register = false` akan menyembunyikan halaman registrasi publik dan hanya admin yang bisa menambah user.

---

### 2.2 Manajemen Pengguna

**Halaman:**
- `/admin/users` — list & search user
- `/admin/users/create` — tambah user manual
- `/admin/users/:id/edit` — edit user
- `/admin/users/import` — import user via file

**Alur — CRUD Manual:**
1. Admin membuka `/admin/users`, melihat list user (dengan filter: divisi, role, status).
2. Admin klik "Tambah Pengguna" → isi form (username, email, password sementara, full name, divisi, role).
3. Submit → sistem validasi unique username/email → create user → kirim email notifikasi (opsional) berisi kredensial awal.
4. Untuk edit: Admin klik user → ubah data (termasuk ganti password user lain) → simpan.
5. Untuk hapus: Admin klik delete → konfirmasi → soft delete user (status jadi `inactive`/`deleted`).

**Alur — Import:**
1. Admin klik "Download Template" → sistem generate file (CSV/XLSX) berisi kolom wajib: `username, email, full_name, division, role, birth_date, phone`.
2. Admin isi template lalu upload di halaman Import.
3. Sistem parsing file, validasi tiap baris (email/username unik, divisi & role harus valid/ada).
4. Sistem menampilkan preview hasil validasi (baris sukses vs baris error + alasan error).
5. Admin konfirmasi import → sistem bulk insert user yang valid.

**Input:**
- Manual: `username, email, password, full_name, division_id, role_id, birth_date, hometown, phone`
- Import: file `.csv`/`.xlsx` sesuai template
- Ganti password: `user_id, new_password`

**Output:**
- List user (paginated, dengan kolom: nama, username, email, divisi, role, jumlah SP, status)
- Hasil import: jumlah baris sukses & gagal + detail error per baris
- Notifikasi sukses create/update/delete

---

### 2.3 Pengelolaan Role & Access

**Halaman:**
- `/admin/roles` — list role
- `/admin/roles/create` / `/admin/roles/:id/edit` — form role + matrix permission

**Alur:**
1. Admin membuka halaman Roles, melihat list role yang ada (Admin, dan role custom lainnya).
2. Admin klik "Tambah Role" → isi nama role & deskripsi.
3. Sistem menampilkan **matrix permission** (list semua module/fitur dengan checkbox permission: view, create, edit, delete, approve, dst — sesuai module).
4. Admin centang permission yang ingin diberikan → simpan.
5. Role tersedia untuk diassign ke user di Manajemen Pengguna.

**Input:**
- `role_name` (string, unique)
- `description` (text, optional)
- `permissions[]` (array of permission_id/code)

**Output:**
- List role beserta jumlah user yang memakai role tersebut
- Detail permission yang aktif per role

**Catatan:** Semua fitur (Events, Absensi, Divisi, Perizinan, SP, Open Recruitment, Surat, Announcement, Settings, User Management, Role Management) masing-masing punya permission granular yang muncul di matrix ini.

---

### 2.4 Profile Pengguna

**Halaman:** `/profile`

**Alur:**
1. User membuka halaman Profile → sistem tampilkan data diri (username, email, divisi, role — read only) dan form yang bisa diedit (full name, tanggal lahir, asal, no telfon, foto profile).
2. User ubah data → simpan → sistem update.
3. Untuk reset password: user klik "Ubah Password" → isi password lama + password baru + konfirmasi → sistem validasi password lama benar → update.

**Input:**
- `full_name, birth_date, hometown, phone, avatar (file image)`
- Reset password: `old_password, new_password, confirm_password`

**Output:**
- Data profile terbaru
- Notifikasi sukses ubah password

---

## 3. Fitur Lainnya

### 3.1 Events

**Halaman:**
- `/events` — list event (user)
- `/events/:id` — detail event (+ tombol Absen jika sedang berlangsung)
- `/admin/events` — list & manage event (admin/role berizin)
- `/admin/events/create` / `/admin/events/:id/edit`
- `/admin/events/:id/recap` — rekap absensi

**Alur — Membuat Event (Admin/role berizin `events.create`):**
1. Buka form Create Event → isi nama, deskripsi, waktu mulai/selesai, lokasi, kategori (General atau Divisi tertentu), toggle `allow_permission` (apakah event ini bisa diajukan izin).
2. Submit → event tersimpan dengan status `upcoming`.
3. Saat waktu event tiba, sistem (cron/scheduler) otomatis mengubah status → `ongoing`, lalu `finished` setelah waktu selesai.

**Alur — User Melihat Event:**
1. User buka `/events` → sistem tampilkan event sesuai visibility (General + Divisi user tersebut, atau semua event jika `allow_cross_division_events_view = true` pada settings).
2. User klik detail event → melihat info lengkap + status absensinya sendiri.

**Alur — Rekap Absensi:**
1. Admin/Panitia buka detail event → klik "Rekap Absensi".
2. Sistem menampilkan list seluruh member yang wajib hadir (berdasar target divisi/general) dengan status: Hadir / Izin / Tidak Hadir, lengkap dengan waktu absen & foto bukti.
3. Bisa export ke Excel/PDF.

**Input:**
- `title, description, division_id (nullable = General), location, start_time, end_time, allow_permission (boolean), banner_image (optional)`

**Output:**
- List/detail event
- Rekap kehadiran: total hadir, izin, tidak hadir + detail per user

---

### 3.2 Absensi

**Halaman:**
- `/events/:id/attendance` — form absen (untuk peserta)
- `/admin/events/:id/permissions` — approval perizinan (untuk role berizin)

**Alur — Melakukan Absensi:**
1. User membuka event yang berstatus `ongoing` → klik "Absen Sekarang".
2. Sistem minta akses kamera → user ambil foto selfie (real-time capture, bukan upload dari galeri, untuk mencegah kecurangan) → sistem otomatis menyertakan timestamp.
3. User membubuhkan tanda tangan digital di Black Place (signature pad/canvas).
4. Submit → sistem simpan record absensi dengan status `present`.

**Alur — Perizinan Terkait Absensi:** (lihat detail di 3.3 Perizinan, terhubung ke event yang `allow_permission = true`)

**Alur — Approval Perizinan:**
1. Role berizin (`attendance.approve`) buka list pengajuan izin pending.
2. Melihat detail: nama user, event, alasan, foto bukti.
3. Klik Approve/Reject (+ catatan opsional).
4. Status absensi user berubah jadi `permitted` (jika approve) atau tetap `absent`/`rejected` (jika reject).

**Input:**
- Absensi: `event_id, user_id, selfie_photo (file, captured), timestamp (auto), signature (base64/svg data dari canvas)`
- Approval: `permission_id, action (approve/reject), note (optional)`

**Output:**
- Status absensi user (`present / permitted / absent / rejected / pending_permission`)
- Notifikasi hasil approval ke user

---

### 3.3 Divisi

**Halaman:**
- `/admin/divisions` — CRUD divisi
- `/divisions/:id` — detail divisi (tugas pokok & fungsi, list anggota)

**Alur:**
1. Admin membuat divisi baru: nama divisi, deskripsi/tugas pokok & fungsi (tupoksi).
2. Saat menambah/edit user (Manajemen Pengguna), admin **wajib** memilih 1 divisi untuk user tersebut.
3. User hanya bisa melihat data (event, dsb.) sesuai divisinya sendiri, kecuali diatur lain di Settings (`allow_cross_division_events_view`) atau punya permission khusus untuk lihat divisi lain.

**Input:**
- `division_name, description/tupoksi`

**Output:**
- List divisi + jumlah anggota
- Detail divisi: tupoksi & list member

---

### 3.4 Perizinan

**Halaman:**
- `/events/:id/permission/create` — ajukan izin
- `/my-permissions` — riwayat pengajuan izin user
- `/admin/permissions` — list semua pengajuan (role approval)

**Alur:**
1. User membuka event yang `allow_permission = true` dan belum absen.
2. Klik "Ajukan Izin" → isi alasan + upload foto/bukti pendukung.
3. Submit → status `pending`, masuk ke antrian approval role berwenang (lihat 3.2 Absensi - Approval Perizinan).
4. User bisa memantau status pengajuannya di `/my-permissions`.

**Input:**
- `event_id, user_id, reason (text), proof_file (image/pdf)`

**Output:**
- Status pengajuan (`pending/approved/rejected`)
- Notifikasi ke user saat status berubah

---

### 3.5 Pelanggaran & Surat Pernyataan (SP)

**Halaman:**
- `/admin/violations` — list pelanggaran & SP
- `/admin/violations/create` — buat SP baru untuk user
- `/admin/users/:id` — pada detail user, muncul badge jumlah SP

**Alur:**
1. Role berizin (`violations.manage`) membuka form buat SP → pilih user, jenis pelanggaran, deskripsi, tingkat SP (SP1/SP2/SP3, dsb.), lampiran dokumen (opsional).
2. Submit → SP tersimpan & terhubung ke user tsb.
3. Di halaman Manajemen Pengguna / detail user, jumlah SP user tersebut otomatis muncul (badge/counter).

**Input:**
- `user_id, violation_type, description, sp_level, document_file (optional), issued_date`

**Output:**
- List SP per user
- Counter total SP per user (ditampilkan di manajemen pengguna)

---

### 3.6 Open Recruitment

**Halaman:**
- `/admin/recruitments` — list & CRUD open recruitment
- `/recruitment/:slug` — halaman publik form pendaftaran (link yang dishare)
- `/admin/recruitments/:id/submissions` — list pendaftar

**Alur:**
1. Admin buat Open Recruitment baru: judul, deskripsi, periode buka-tutup, daftar divisi yang dibuka, custom fields tambahan (opsional).
2. Sistem generate **link/slug unik** yang bisa dishare (`/recruitment/{slug}`).
3. Calon pendaftar (publik, tanpa login) membuka link → isi form: Nama, Divisi yang diminati, kontak, dsb. (field tambahan via custom fields admin).
4. Submit → data pendaftar tersimpan, muncul di dashboard admin sebagai list submission.
5. Admin bisa export data pendaftar / mengubah status pendaftar (misal: lolos, tidak lolos, interview).

**Input:**
- Setup: `title, description, open_date, close_date, target_divisions[], custom_fields[]`
- Submission (publik): `name, division_interest, contact, jawaban_custom_fields[]` (`nim` opsional/legacy, bukan field bawaan form)

**Output:**
- Link form recruitment
- List pendaftar (dengan filter status & divisi)

---

### 3.7 Surat Masuk & Surat Keluar

**Halaman:**
- `/admin/letters/incoming` — surat masuk
- `/admin/letters/outgoing` — surat keluar
- `/admin/letters/categories` — pengaturan kategori & format nomor surat

**Alur — Setup Kategori & Nomor Awal:**
1. Admin buat kategori surat (misal: "Undangan", "Surat Keputusan") dengan kode kategori (misal: `UND`, `SK`).
2. Admin atur nomor surat dimulai dari berapa (`start_number`) untuk kategori tersebut, format template kode (misal: `{nomor}/{kategori}/{bulan_romawi}/{tahun}`).

**Alur — Membuat Surat:**
1. Admin/role berizin pilih jenis (Masuk/Keluar) → pilih kategori → isi data surat (perihal, tanggal, pengirim/penerima, file lampiran).
2. Sistem otomatis generate **kode surat** = nomor urut berjalan (increment dari `start_number` kategori tsb) + kode kategori sesuai template.
3. Surat tersimpan dan bisa dicari/filter berdasar kategori, tanggal, nomor.

**Input:**
- Kategori: `category_name, category_code, start_number, number_format_template`
- Surat: `type (incoming/outgoing), category_id, subject, date, sender/recipient, attachment_file, description`

**Output:**
- Kode surat otomatis (auto-generated)
- List & pencarian surat masuk/keluar

---

### 3.8 Announcement

**Halaman:**
- `/announcements` — list pengumuman (semua user)
- `/admin/announcements/create` — buat pengumuman (role berizin `announcement.create`)

**Alur:**
1. Role berizin buka form buat pengumuman → isi judul, konten (rich text), lampiran gambar/file, target (Semua user / Divisi tertentu).
2. Submit → pengumuman langsung tayang & (opsional) trigger notifikasi ke target user.
3. User target melihat pengumuman di halaman `/announcements` atau dashboard.

**Input:**
- `title, content (rich text), attachments[] (images/files), target_type (all/division), target_division_id (nullable), publish_date`

**Output:**
- List pengumuman sesuai target visibility user yang login
- Notifikasi (in-app/email) ke user target

---

## 4. Database Schema

Notasi tipe generik (PostgreSQL-style). `uuid` dipakai sebagai primary key di semua tabel untuk kemudahan sinkronisasi/import.

### 4.1 organization_settings
```
id                              uuid PK
web_name                        varchar(100)
logo_url                        varchar(255)
icon_url                        varchar(255)
theme                           varchar(50)         -- preset key, e.g. 'default-blue'
allow_self_register             boolean  default false
allow_cross_division_events_view boolean default false
created_at / updated_at         timestamp
```

### 4.2 users
```
id              uuid PK
username        varchar(50)  unique
email           varchar(100) unique
password_hash   varchar(255)
full_name       varchar(150)
birth_date      date
hometown        varchar(100)
phone           varchar(20)
avatar_url      varchar(255)
division_id     uuid FK -> divisions.id
role_id         uuid FK -> roles.id
status          enum('active','inactive','deleted') default 'active'
created_at / updated_at   timestamp
```

### 4.3 roles
```
id           uuid PK
name         varchar(50) unique
description  text
is_system    boolean default false   -- true untuk role Admin bawaan (tidak bisa dihapus)
created_at / updated_at  timestamp
```

### 4.4 permissions
```
id            uuid PK
code          varchar(100) unique   -- e.g. 'events.create', 'attendance.approve'
module        varchar(50)           -- e.g. 'events', 'users', 'letters'
description   varchar(255)
```

### 4.5 role_permissions
```
id             uuid PK
role_id        uuid FK -> roles.id
permission_id  uuid FK -> permissions.id
UNIQUE(role_id, permission_id)
```

### 4.6 divisions
```
id            uuid PK
name          varchar(100)
description   text     -- tugas pokok & fungsi
created_at / updated_at  timestamp
```

### 4.7 events
```
id                 uuid PK
title              varchar(150)
description        text
division_id        uuid FK -> divisions.id NULLABLE  -- null = General
location           varchar(255)
banner_url         varchar(255)
start_time         timestamp
end_time           timestamp
allow_permission   boolean default false
status             enum('upcoming','ongoing','finished','cancelled') default 'upcoming'
created_by         uuid FK -> users.id
created_at / updated_at  timestamp
```

### 4.8 attendances
```
id             uuid PK
event_id       uuid FK -> events.id
user_id        uuid FK -> users.id
status         enum('present','permitted','absent','rejected') default 'absent'
selfie_url     varchar(255)
signature_url  varchar(255)   -- image hasil canvas signature
checked_in_at  timestamp
UNIQUE(event_id, user_id)
```

### 4.9 permission_requests  (Perizinan)
```
id            uuid PK
event_id      uuid FK -> events.id
user_id       uuid FK -> users.id
reason        text
proof_url     varchar(255)
status        enum('pending','approved','rejected') default 'pending'
reviewed_by   uuid FK -> users.id NULLABLE
review_note   text
reviewed_at   timestamp NULLABLE
created_at    timestamp
```

### 4.10 violations  (Pelanggaran & SP)
```
id              uuid PK
user_id         uuid FK -> users.id
violation_type  varchar(100)
description     text
sp_level        varchar(20)      -- e.g. 'SP1','SP2','SP3'
document_url    varchar(255) NULLABLE
issued_by       uuid FK -> users.id
issued_date     date
created_at      timestamp
```

### 4.11 recruitments
```
id                uuid PK
title             varchar(150)
description       text
slug              varchar(100) unique
open_date         date
close_date        date
status            enum('draft','open','closed') default 'draft'
created_by        uuid FK -> users.id
created_at / updated_at  timestamp
```

### 4.12 recruitment_target_divisions
```
id              uuid PK
recruitment_id  uuid FK -> recruitments.id
division_id     uuid FK -> divisions.id
```

### 4.13 recruitment_custom_fields
```
id              uuid PK
recruitment_id  uuid FK -> recruitments.id
field_label     varchar(100)
field_type      enum('text','number','textarea','select','file')
field_options   jsonb NULLABLE     -- untuk type 'select'
is_required     boolean default true
order_index     int
```

### 4.14 recruitment_submissions
```
id                uuid PK
recruitment_id    uuid FK -> recruitments.id
name              varchar(150)
nim               varchar(50)
division_interest uuid FK -> divisions.id
contact           varchar(100)
custom_answers    jsonb            -- {field_id: answer}
status            enum('submitted','interview','accepted','rejected') default 'submitted'
submitted_at      timestamp
```

### 4.15 letter_categories
```
id                      uuid PK
name                    varchar(100)
code                    varchar(20)     -- e.g. 'UND', 'SK'
start_number            int default 1
current_number          int default 0   -- counter berjalan
number_format_template  varchar(100)    -- e.g. '{number}/{code}/{month_roman}/{year}'
```

### 4.16 letters
```
id             uuid PK
type           enum('incoming','outgoing')
category_id    uuid FK -> letter_categories.id
letter_code    varchar(100)         -- hasil generate dari template + counter
subject        varchar(255)
letter_date    date
sender         varchar(150) NULLABLE   -- untuk surat masuk
recipient      varchar(150) NULLABLE   -- untuk surat keluar
description    text
attachment_url varchar(255) NULLABLE
created_by     uuid FK -> users.id
created_at     timestamp
```

### 4.17 announcements
```
id            uuid PK
title         varchar(200)
content       text            -- rich text / HTML
target_type   enum('all','division')
target_division_id  uuid FK -> divisions.id NULLABLE
publish_date  timestamp
created_by    uuid FK -> users.id
created_at / updated_at  timestamp
```

### 4.18 announcement_attachments
```
id               uuid PK
announcement_id  uuid FK -> announcements.id
file_url         varchar(255)
file_type        enum('image','document')
```

### 4.19 Relasi Ringkas (ERD narasi)
- `users` → banyak ke `divisions` (many-to-one) dan `roles` (many-to-one)
- `roles` ↔ `permissions` melalui `role_permissions` (many-to-many)
- `events` → punya banyak `attendances` dan `permission_requests` (one-to-many)
- `recruitments` → punya banyak `recruitment_custom_fields`, `recruitment_target_divisions`, `recruitment_submissions`
- `letter_categories` → punya banyak `letters`, sekaligus mengontrol penomoran otomatis
- `announcements` → punya banyak `announcement_attachments`

---

## 5. API Endpoints

Base URL contoh: `https://api.myorg.app/v1`. Semua endpoint (kecuali `auth` & `recruitment` publik) membutuhkan header `Authorization: Bearer <token>`. Response error mengikuti format standar:
```json
{ "success": false, "message": "Pesan error", "errors": { "field": ["detail error"] } }
```

### 5.1 Auth
| Method | Endpoint | Deskripsi |
|---|---|---|
| POST | `/auth/login` | Login |
| POST | `/auth/logout` | Logout |
| POST | `/auth/register` | Register mandiri (jika `allow_self_register = true`) |

**POST `/auth/login`**
```json
// Request
{ "username": "budi.santoso", "password": "rahasia123" }

// Response 200
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "8f2b...", "username": "budi.santoso", "full_name": "Budi Santoso",
      "role": "Ketua Divisi", "division": "Divisi IT"
    }
  }
}
```

---

### 5.2 System Settings
| Method | Endpoint | Permission |
|---|---|---|
| GET | `/settings` | public (untuk branding) |
| PUT | `/settings` | `settings.manage` |

**PUT `/settings`**
```json
// Request (multipart/form-data)
{
  "web_name": "HIMA Informatika",
  "theme": "default-blue",
  "allow_self_register": false,
  "allow_cross_division_events_view": true,
  "logo": "<file>",
  "icon": "<file>"
}

// Response 200
{
  "success": true,
  "data": {
    "web_name": "HIMA Informatika",
    "logo_url": "https://cdn.myorg.app/settings/logo_20260716.png",
    "theme": "default-blue",
    "allow_self_register": false,
    "allow_cross_division_events_view": true
  }
}
```

---

### 5.3 Manajemen Pengguna
| Method | Endpoint | Permission |
|---|---|---|
| GET | `/users` | `users.view` |
| GET | `/users/:id` | `users.view` |
| POST | `/users` | `users.create` |
| PUT | `/users/:id` | `users.edit` |
| DELETE | `/users/:id` | `users.delete` |
| PUT | `/users/:id/password` | `users.edit` |
| GET | `/users/import/template` | `users.import` |
| POST | `/users/import` | `users.import` |

**GET `/users?division_id=&role_id=&page=1&limit=20`**
```json
// Response 200
{
  "success": true,
  "data": [
    {
      "id": "8f2b...", "username": "budi.santoso", "email": "budi@myorg.app",
      "full_name": "Budi Santoso", "division": "Divisi IT", "role": "Ketua Divisi",
      "sp_count": 1, "status": "active"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 87 }
}
```

**POST `/users`**
```json
// Request
{
  "username": "citra.dewi", "email": "citra@myorg.app", "password": "TempPass123",
  "full_name": "Citra Dewi", "division_id": "d1a2...", "role_id": "r3b4...",
  "birth_date": "2003-05-10", "hometown": "Cilacap", "phone": "081234567890"
}

// Response 201
{
  "success": true,
  "data": { "id": "u9f8...", "username": "citra.dewi", "status": "active" },
  "message": "Pengguna berhasil dibuat"
}
```

**POST `/users/import`**
```json
// Request (multipart/form-data): file = users_import.xlsx

// Response 200
{
  "success": true,
  "data": {
    "success_count": 42,
    "failed_count": 3,
    "failed_rows": [
      { "row": 5, "reason": "Email sudah terdaftar" },
      { "row": 12, "reason": "Divisi 'Divisi X' tidak ditemukan" }
    ]
  }
}
```

---

### 5.4 Role & Access
| Method | Endpoint | Permission |
|---|---|---|
| GET | `/roles` | `roles.view` |
| POST | `/roles` | `roles.create` |
| PUT | `/roles/:id` | `roles.edit` |
| DELETE | `/roles/:id` | `roles.delete` |
| GET | `/permissions` | `roles.view` (untuk isi matrix) |

**POST `/roles`**
```json
// Request
{
  "name": "Bendahara",
  "description": "Mengelola keuangan divisi",
  "permissions": ["events.view", "attendance.view", "letters.manage"]
}

// Response 201
{
  "success": true,
  "data": { "id": "r7c9...", "name": "Bendahara", "permissions_count": 3 }
}
```

---

### 5.5 Profile
| Method | Endpoint |
|---|---|
| GET | `/me` |
| PUT | `/me` |
| PUT | `/me/password` |

**PUT `/me`**
```json
// Request
{ "full_name": "Budi Santoso", "birth_date": "2002-08-17", "hometown": "Purwokerto", "phone": "081298765432" }

// Response 200
{ "success": true, "message": "Profil berhasil diperbarui" }
```

---

### 5.6 Events
| Method | Endpoint | Permission |
|---|---|---|
| GET | `/events` | `events.view` |
| GET | `/events/:id` | `events.view` |
| POST | `/events` | `events.create` |
| PUT | `/events/:id` | `events.edit` |
| DELETE | `/events/:id` | `events.delete` |
| GET | `/events/:id/recap` | `events.view` |

**POST `/events`**
```json
// Request
{
  "title": "Rapat Koordinasi Divisi IT",
  "description": "Membahas progress sistem MyOrg",
  "division_id": "d1a2...",
  "location": "Ruang Sekretariat",
  "start_time": "2026-07-20T13:00:00+07:00",
  "end_time": "2026-07-20T15:00:00+07:00",
  "allow_permission": true
}

// Response 201
{
  "success": true,
  "data": { "id": "e5f1...", "title": "Rapat Koordinasi Divisi IT", "status": "upcoming" }
}
```

**GET `/events/:id/recap`**
```json
// Response 200
{
  "success": true,
  "data": {
    "event": { "id": "e5f1...", "title": "Rapat Koordinasi Divisi IT" },
    "summary": { "present": 18, "permitted": 2, "absent": 3, "total_target": 23 },
    "details": [
      { "user_id": "u9f8...", "full_name": "Citra Dewi", "status": "present", "checked_in_at": "2026-07-20T13:02:11+07:00" },
      { "user_id": "u1a1...", "full_name": "Dimas Prakoso", "status": "permitted" }
    ]
  }
}
```

---

### 5.7 Absensi
| Method | Endpoint | Permission |
|---|---|---|
| POST | `/events/:id/attendance` | `attendance.submit` |
| GET | `/events/:id/attendance/me` | `attendance.submit` |
| GET | `/attendance/permission-requests` | `attendance.approve` |
| PUT | `/attendance/permission-requests/:id` | `attendance.approve` |

**POST `/events/:id/attendance`**
```json
// Request (multipart/form-data)
{ "selfie_photo": "<file>", "signature": "data:image/png;base64,iVBOR..." }

// Response 201
{
  "success": true,
  "data": { "status": "present", "checked_in_at": "2026-07-20T13:02:11+07:00" }
}
```

**PUT `/attendance/permission-requests/:id`**
```json
// Request
{ "action": "approve", "note": "Sudah konfirmasi ke ketua" }

// Response 200
{ "success": true, "message": "Perizinan disetujui", "data": { "status": "approved" } }
```

---

### 5.8 Divisi
| Method | Endpoint | Permission |
|---|---|---|
| GET | `/divisions` | `divisions.view` |
| POST | `/divisions` | `divisions.create` |
| PUT | `/divisions/:id` | `divisions.edit` |
| DELETE | `/divisions/:id` | `divisions.delete` |

**POST `/divisions`**
```json
// Request
{ "name": "Divisi Humas", "description": "Bertanggung jawab atas publikasi & kerjasama eksternal" }

// Response 201
{ "success": true, "data": { "id": "d8e2...", "name": "Divisi Humas" } }
```

---

### 5.9 Perizinan
| Method | Endpoint | Permission |
|---|---|---|
| POST | `/permission-requests` | `permission.submit` |
| GET | `/permission-requests/me` | `permission.submit` |

**POST `/permission-requests`**
```json
// Request (multipart/form-data)
{ "event_id": "e5f1...", "reason": "Sakit demam, terlampir surat dokter", "proof_file": "<file>" }

// Response 201
{ "success": true, "data": { "id": "p3d7...", "status": "pending" } }
```

---

### 5.10 Pelanggaran & SP
| Method | Endpoint | Permission |
|---|---|---|
| GET | `/violations?user_id=` | `violations.view` |
| POST | `/violations` | `violations.manage` |
| DELETE | `/violations/:id` | `violations.manage` |

**POST `/violations`**
```json
// Request
{
  "user_id": "u9f8...", "violation_type": "Tidak hadir tanpa keterangan 3x",
  "description": "Tidak hadir rapat rutin 3 kali berturut-turut tanpa izin",
  "sp_level": "SP1", "issued_date": "2026-07-16"
}

// Response 201
{ "success": true, "data": { "id": "v2a4...", "sp_level": "SP1" } }
```

---

### 5.11 Open Recruitment
| Method | Endpoint | Permission |
|---|---|---|
| GET | `/recruitments` | `recruitment.manage` |
| POST | `/recruitments` | `recruitment.manage` |
| PUT | `/recruitments/:id` | `recruitment.manage` |
| GET | `/recruitments/:id/submissions` | `recruitment.manage` |
| GET | `/public/recruitment/:slug` | public |
| POST | `/public/recruitment/:slug/submit` | public |

**POST `/recruitments`**
```json
// Request
{
  "title": "Open Recruitment Staff Magang 2026",
  "description": "Pendaftaran anggota baru periode 2026/2027",
  "open_date": "2026-08-01", "close_date": "2026-08-15",
  "target_divisions": ["d1a2...", "d8e2..."],
  "custom_fields": [
    { "field_label": "Motivasi bergabung", "field_type": "textarea", "is_required": true }
  ]
}

// Response 201
{ "success": true, "data": { "id": "rc4f...", "slug": "staff-magang-2026" } }
```

**POST `/public/recruitment/:slug/submit`**
```json
// Request
{
  "name": "Anisa Rahma", "nim": "21102001", "division_interest": "d1a2...",
  "contact": "081211112222",
  "custom_answers": { "<field_id>": "Ingin mengembangkan skill teknis dan berorganisasi" }
}

// Response 201
{ "success": true, "message": "Pendaftaran berhasil dikirim" }
```

---

### 5.12 Surat Masuk & Surat Keluar
| Method | Endpoint | Permission |
|---|---|---|
| GET | `/letter-categories` | `letters.manage` |
| POST | `/letter-categories` | `letters.manage` |
| GET | `/letters?type=&category_id=` | `letters.view` |
| POST | `/letters` | `letters.manage` |

**POST `/letter-categories`**
```json
// Request
{ "name": "Undangan", "code": "UND", "start_number": 1, "number_format_template": "{number}/{code}/{month_roman}/{year}" }

// Response 201
{ "success": true, "data": { "id": "lc1a...", "code": "UND" } }
```

**POST `/letters`**
```json
// Request (multipart/form-data)
{
  "type": "outgoing", "category_id": "lc1a...", "subject": "Undangan Rapat Kerja Divisi",
  "letter_date": "2026-07-16", "recipient": "Seluruh Anggota Divisi IT",
  "attachment_file": "<file>"
}

// Response 201
{
  "success": true,
  "data": { "id": "lt5b...", "letter_code": "008/UND/VII/2026" }
}
```

---

### 5.13 Announcement
| Method | Endpoint | Permission |
|---|---|---|
| GET | `/announcements` | authenticated (filtered by target) |
| POST | `/announcements` | `announcement.create` |
| PUT | `/announcements/:id` | `announcement.create` |
| DELETE | `/announcements/:id` | `announcement.create` |

**POST `/announcements`**
```json
// Request (multipart/form-data)
{
  "title": "Pengumuman Libur Kegiatan",
  "content": "<p>Seluruh kegiatan organisasi diliburkan tanggal 20-22 Juli 2026.</p>",
  "target_type": "all",
  "publish_date": "2026-07-16T09:00:00+07:00",
  "attachments[]": "<file>"
}

// Response 201
{ "success": true, "data": { "id": "an3c...", "title": "Pengumuman Libur Kegiatan" } }
```

**GET `/announcements`**
```json
// Response 200
{
  "success": true,
  "data": [
    {
      "id": "an3c...", "title": "Pengumuman Libur Kegiatan", "target_type": "all",
      "publish_date": "2026-07-16T09:00:00+07:00",
      "attachments": [{ "file_url": "https://cdn.myorg.app/announcements/flyer.png", "file_type": "image" }]
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 5 }
}
```

---

## 6. Ringkasan Halaman (Sitemap)

| Area | Halaman |
|---|---|
| Publik | `/login`, `/register` (jika diaktifkan), `/recruitment/:slug` |
| User Umum | `/dashboard`, `/profile`, `/events`, `/events/:id`, `/events/:id/attendance`, `/my-permissions`, `/announcements` |
| Admin/Role Berizin | `/admin/settings`, `/admin/users`, `/admin/users/import`, `/admin/roles`, `/admin/events`, `/admin/events/:id/recap`, `/admin/divisions`, `/admin/permissions`, `/admin/violations`, `/admin/recruitments`, `/admin/recruitments/:id/submissions`, `/admin/letters/incoming`, `/admin/letters/outgoing`, `/admin/letters/categories`, `/admin/announcements/create` |

---

*Dokumen ini adalah pengembangan detail dari PRD awal MyOrganizations System, mencakup alur kerja, input/output, halaman, skema database, dan spesifikasi API untuk setiap fitur.*
