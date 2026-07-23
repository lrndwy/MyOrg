# DESIGN.md — MyOrganizations System (Grit Framework)

Dokumen ini menerjemahkan [`PRD.md`](PRD.md) menjadi keputusan arsitektur konkret di atas Grit Framework: mode aplikasi, pemetaan resource ke `grit generate resource`, model permission, background jobs, storage, dan modul lintas-fitur.

Panduan kerja AI agent: [`AGENTS.md`](AGENTS.md), [`CLAUDE.md`](CLAUDE.md).

## 1. Mode Arsitektur

**Triple mode**, Next.js frontend (sudah di-scaffold di repo ini):
```bash
grit new . --triple --next
```
Alasan:
- Butuh 2 permukaan UI berbeda secara jelas: **Web** (user umum: absensi, event, profile, announcement) dan **Admin** (settings, manajemen user/role, approval, surat, recruitment, SP). Triple mode memisahkan ini jadi 2 app Next.js berbeda dari 1 API Go yang sama, sesuai kebutuhan PRD §6 (Ringkasan Halaman/Sitemap).
- Admin panel bawaan Grit (auto-generated page per resource) mempercepat pembuatan CRUD Divisi, Role, Letter Categories, dsb.

Shared types/schemas hasil `grit sync` hidup di `packages/shared/` (bukan `packages/schema/`).

## 2. Domain Model → Grit Resource Mapping

Setiap tabel di PRD §4 dipetakan ke command `grit generate resource`. Urutan generate mengikuti dependency (yang di-reference lebih dulu).

### 2.1 Division
```bash
grit generate resource Division --fields "name:string,description:text"
```

### 2.2 Role & Permission (custom RBAC, lihat §4)
```bash
grit generate resource Role --fields "name:string:unique,description:text:optional,isSystem:bool"
grit generate resource Permission --fields "code:string:unique,module:string,description:string:optional"
# Junction many-to-many
grit generate resource RolePermission --fields "role:belongs_to:Role,permission:belongs_to:Permission"
```

### 2.3 User (extend model bawaan Grit auth)
Grit sudah membawa model User dasar untuk auth di `apps/api/internal/models/user.go`. Extend field tambahan sesuai PRD via edit model (bukan generate resource baru), lalu `grit sync`:
```
username        string  # unique; login identifier utama (PRD §5.1)
fullName        string
birthDate       date (optional)
hometown        string (optional)
phone           string (optional)
avatarUrl       string (optional)
division        belongs_to Division
appRole         belongs_to Role   # role kustom aplikasi (AppRoleID); terpisah dari role bawaan Grit (ADMIN/EDITOR/USER)
status          string  # active | inactive | deleted (default active)
```
Pertahankan field Grit bawaan yang tidak konflik (`Email`, `Password`, base `Role` untuk gate admin panel). Di UI MyOrg, tampilkan `fullName` (bukan `first_name`/`last_name` Grit). Auth login mendukung **username** (utama) dan email (fallback).

### 2.4 OrganizationSettings
Singleton resource (hanya 1 row). Generate seperti resource biasa lalu batasi di service layer supaya hanya 1 record.
```bash
grit generate resource OrganizationSetting --fields "webName:string,logoUrl:string:optional,iconUrl:string:optional,theme:string,allowSelfRegister:bool,allowCrossDivisionEventsView:bool"
```

**Admin UI:** bukan CRUD list. Edit hanya lewat `/myorg/settings` (form singleton). Resource tidak didaftarkan di sidebar `resources/index.ts`. `POST` kedua ditolak (409); `DELETE` dinonaktifkan. Update selalu ke row yang ada.

### 2.5 Event
```bash
grit generate resource Event --fields "title:string,description:text,division:belongs_to:Division:optional,location:string,bannerUrl:string:optional,startTime:datetime,endTime:datetime,allowPermission:bool,status:string"
```
`division` nullable = General event (lihat PRD §3.1).

### 2.6 Attendance
```bash
grit generate resource Attendance --fields "event:belongs_to:Event,user:belongs_to:User,status:string,selfieUrl:string:optional,signatureUrl:string:optional,checkedInAt:datetime:optional"
```
Tambahkan unique composite index `(event_id, user_id)` manual di migration (dicatat di §7 — kasus khusus di luar generator default).

### 2.7 PermissionRequest (Perizinan)
```bash
grit generate resource PermissionRequest --fields "event:belongs_to:Event,user:belongs_to:User,reason:text,proofUrl:string,status:string,reviewedBy:belongs_to:User:optional,reviewNote:text:optional,reviewedAt:datetime:optional"
```

### 2.8 Violation (Pelanggaran & SP)
```bash
grit generate resource Violation --fields "user:belongs_to:User,violationType:string,description:text,spLevel:string,documentUrl:string:optional,issuedBy:belongs_to:User,issuedDate:date"
```

### 2.9 Recruitment
```bash
grit generate resource Recruitment --fields "title:string,description:text,slug:slug:title,openDate:date,closeDate:date,status:string"
grit generate resource RecruitmentTargetDivision --fields "recruitment:belongs_to:Recruitment,division:belongs_to:Division"
grit generate resource RecruitmentCustomField --fields "recruitment:belongs_to:Recruitment,fieldLabel:string,fieldType:string,fieldOptions:string_array:optional,isRequired:bool,orderIndex:int"
grit generate resource RecruitmentSubmission --fields "recruitment:belongs_to:Recruitment,name:string,nim:string,divisionInterest:belongs_to:Division,contact:string,customAnswers:text,status:string"
```
`nim` tetap ada di kolom DB (kompatibilitas data lama) tetapi **bukan field bawaan form publik** — opsional di API create/submit; UI form publik & daftar submission admin tidak menampilkan NIM. Field identitas tambahan (jika perlu) lewat `RecruitmentCustomField`.
`customAnswers` disimpan sebagai JSON string (atau `datatypes.JSON` custom type — dicatat di §7 sebagai penyesuaian manual pasca-generate karena field generator standar belum punya tipe `json`).

### 2.10 Letter
```bash
grit generate resource LetterCategory --fields "name:string,code:string:unique,startNumber:int,currentNumber:int,numberFormatTemplate:string"
grit generate resource LetterTemplate --fields "name:string,category:belongs_to:LetterCategory,templateUrl:string"
grit generate resource Letter --fields "type:string,category:belongs_to:LetterCategory,template:belongs_to:LetterTemplate:optional,letterCode:string,subject:string:optional,letterDate:date:optional,sender:string:optional,recipient:string:optional,variableValues:json:optional,documentUrl:string:optional"
```

**Tidak ada** child Signature/Attachment, dan **tidak ada** kop surat di Organization Settings. Template `.docx` dikelola lewat `LetterTemplate`.

**Letter Template (CRUD):** name, kategori, upload `.docx` → `template_url`. `GET /api/letter_templates/:id/variables` mendeteksi `{PLACEHOLDER}` di file.

**Outgoing:** pilih template → isi variabel (termasuk `{NOMOR_SURAT}` suggested dari counter kategori, bisa di-override) → merge → `document_url`. File bisa di-update setelah create.

**Incoming:** form admin hanya **Subject** + **upload file** (`.docx`, PDF, atau gambar). Kategori internal `SM-IN` (Surat Masuk) di-assign otomatis — **bukan** counter nomor kategori outgoing. `letter_code` diisi otomatis dengan hasil scan/parse teks file (`POST /api/letters/parse-incoming` untuk preview; create menjalankan parsing yang sama). **PDF digital** (text layer) dibaca langsung; **PDF hasil scan fisik** (hanya gambar) difallback ke OCR: Tesseract pada file/halaman PDF (`pdftoppm` dari poppler jika perlu konversi halaman). Gambar membutuhkan **tesseract** (binary di container API, atau `TESSERACT_HTTP_URL` → service `ocr` di docker compose dev).

**Placeholder:** `{TEMPAT_TANGGAL_SURAT_DIBUAT}`, `{NOMOR_SURAT}`, `{LEMBAR_LAMPIRAN}`, `{EJA_LEMBAR_LAMPIRAN}`, `{TUJUAN_INSTANSI}`, `{NAMA_KEGIATAN}`, `{NAMA_ORGANISASI}`, `{NAMA_LENGKAP_JURI_INTERNAL}`, `{HARI_TANGGAL_KEGIATAN}`, `{WAKTU_MULAI_SELESAI_KEGIATAN}`, `{TEMPAT_KEGIATAN}`, `{GENDER_HORMAT}`, `{MATA_LOMBA}`, `{PEMBINA_DARI}`, `{KETUA_DARI}`, `{NAMA_PEMBINA}`, `{NIP_PEMBINA}`, `{NAMA_KETUA}`, `{NIM_KETUA}`, `{JUMLAH_ATAU_NAMA_ORANG}`, `{DIUNDANG_SEBAGAI}`, `{ALASAN_SPESIFIK_PENGAJUAN}`, `{NAMA_NARSUM_LENGKAP_JABATAN_INSTANSI}`, `{NAMA_JURI_EXTERNAL_LENGKAP_JABATAN_INSTANSI}`, `{NAMA_JURI_INTERNAL_LENGKAP_JABATAN_INSTANSI}`, `{MATERI}`. Alias legacy: `{NOMOR}` / `{LETTER_CODE}` ↔ `{NOMOR_SURAT}`.

### 2.11 Announcement
```bash
grit generate resource Announcement --fields "title:string,content:richtext,targetType:string,targetDivision:belongs_to:Division:optional,publishDate:datetime"
grit generate resource AnnouncementAttachment --fields "announcement:belongs_to:Announcement,fileUrl:string,fileType:string"
```

**UI:** Announcement Attachments **tidak** punya menu admin terpisah. Attachment diunggah inline di form Create/Edit Announcement (`type: files`, multi). API tetap punya CRUD `/api/announcement_attachments` bila diperlukan; create/update announcement menerima nested `attachments[]` (FileRef atau `{file_url,file_type}`). List/Get announcement mem-preload `attachments`.

### 2.12 Keuangan (Bendahara)
```bash
grit generate resource FinanceCategory --fields "name:string,type:string,description:text:optional"
grit generate resource FinanceTransaction --fields "type:string,amount:float,description:text,proofUrl:string:optional,transactionDate:date,category:belongs_to:FinanceCategory,recordedBy:belongs_to:User:optional"
```

- **`finance_categories.type`:** `income` (pemasukan) | `expense` (pengeluaran).
- **`finance_transactions`:** ledger — `amount`, `description`, `proof_url`, `transaction_date`, kategori. `recorded_by` otomatis dari user login.
- **Permission:** `finance.view`, `finance.create`, `finance.edit`, `finance.delete`, `finance.categories`, `finance.manage` (akses penuh tulis).
- **Admin UI:** `/myorg/finance` (stat cards, grafik arus kas, breakdown kategori, detail cashflow, update terbaru); kategori di `/resources/finance-categories`.
- **API:** `GET /api/finance_transactions/summary` → `{ total_income, total_expense, balance }`; `GET /api/finance_transactions/dashboard?days=30` → agregat all-time / minggu ini / bulan ini, series cashflow harian, breakdown kategori, `recent_updates`.

Setelah semua resource digenerate: jalankan `grit sync` sekali lagi untuk memastikan seluruh Zod schema & TS types di `packages/shared` konsisten.

## 3. Endpoint Publik (di luar auth JWT)

Beberapa endpoint di PRD §5 bersifat publik (recruitment form, branding settings untuk halaman login). Grit generator men-generate route dengan auth middleware default; route publik perlu dikecualikan manual di `apps/api/internal/routes/`:
- `GET /settings` (subset field saja: `web_name`, `logo_url`, `icon_url`, `theme`) — dibuat sebagai endpoint custom terpisah dari CRUD admin settings.
- `GET /public/recruitment/:slug`
- `POST /public/recruitment/:slug/submit`

### 3.1 Endpoint Kustom (di luar CRUD generator)

| Endpoint | Auth | Catatan |
|----------|------|---------|
| `GET /settings` | Public | Subset branding |
| `PUT /settings` | `settings.manage` | Multipart logo/icon |
| `GET /me`, `PUT /me`, `PUT /me/password` | JWT | Profile user |
| `GET /events/:id/recap` | `events.view` | Aggregasi kehadiran + export |
| `POST /events/:id/attendance` | `attendance.submit` | Selfie + signature |
| `GET/PUT /attendance/permission-requests/*` | `attendance.approve` | Approval flow |
| `POST /permission-requests`, `GET /permission-requests/me` | `permission.submit` | Ajukan & riwayat izin |
| `GET /users/import/template`, `POST /users/import` | `users.import` | Bulk import |
| `GET /public/recruitment/:slug` | Public | Form publik |
| `POST /public/recruitment/:slug/submit` | Public | Submission tanpa login |
| `GET /backups`, `POST /backups/generate`, `GET /backups/export` | ADMIN | Backup DB penuh → ZIP |
| `POST /backups/restore`, `POST /backups/:id/restore` | ADMIN | Restore dari upload ZIP / backup tersimpan |
| `GET /backups/:id/download` | ADMIN | Pre-signed URL arsip di object storage |
| `GET/PUT /backup-settings` | ADMIN | Jadwal backup otomatis |

## 4. Model Role & Permission (Custom RBAC di atas Grit Auth)

Grit built-in menyediakan role tetap `ADMIN` / `EDITOR` / `USER` untuk gate akses ke tooling framework (Studio, Pulse UI, dsb.). PRD butuh **role dinamis** yang bisa dibuat/diedit admin dengan permission granular per modul — dua sistem ini dijalankan berdampingan:

| Layer | Fungsi | Sumber |
|---|---|---|
| Grit base role (`ADMIN`/`EDITOR`/`USER`) | Gate infrastruktur: siapa boleh akses `/studio`, `/pulse/ui`, `/sentinel/ui`, admin panel | Built-in Grit auth |
| Custom Role + Permission (tabel `roles`, `permissions`, `role_permissions`) | Gate fitur bisnis: siapa boleh `events.create`, `attendance.approve`, dst. | Aplikasi (§2.2) |

**Middleware permission check** (`apps/api/internal/middleware/permission.go`, ditulis manual — bukan hasil generator):
```go
func RequirePermission(code string) gin.HandlerFunc {
    return func(c *gin.Context) {
        user := auth.CurrentUser(c)
        if !permissionService.UserHasPermission(user.AppRoleID, code) {
            c.AbortWithStatusJSON(403, gin.H{"success": false, "message": "Tidak memiliki akses"})
            return
        }
        c.Next()
    }
}
```
Dipasang di route resource sensitif, contoh:
```go
events.POST("", RequirePermission("events.create"), eventHandler.Create)
attendance.PUT("/permission-requests/:id", RequirePermission("attendance.approve"), attendanceHandler.ReviewPermission)
```

Daftar awal permission code mengikuti modul PRD: `settings.manage`, `users.view/create/edit/delete/import`, `roles.view/create/edit/delete`, `events.view/create/edit/delete`, `attendance.submit/approve`, `divisions.view/create/edit/delete`, `permission.submit`, `violations.view/manage`, `recruitment.manage`, `letters.view/manage`, `announcement.create`, `finance.view/create/edit/delete/categories/manage`. Seed awal ada di `grit seed` (lihat §6). Role sistem **Bendahara** otomatis mendapat semua permission modul `finance.*`.

## 5. Business Logic Kunci (di Service Layer)

Semua logic non-trivial di `apps/api/internal/services/`, bukan handler.

### 5.1 Event Status Transition
Cron job (`asynq` scheduler) berjalan tiap menit:
- `upcoming → ongoing` saat `now >= start_time`
- `ongoing → finished` saat `now >= end_time`
Diregistrasi di `apps/api/internal/jobs/event_status_cron.go`.

### 5.2 Absensi & Perizinan
- Endpoint absensi menolak submit jika `event.status != 'ongoing'`.
- Upload selfie & signature langsung ke S3-compatible storage (presigned URL flow bawaan Grit), hanya URL yang disimpan di DB.
- Approval perizinan (`PUT /attendance/permission-requests/:id`) mengubah `attendances.status` menjadi `permitted` melalui service transaction (update 2 tabel sekaligus: `permission_requests` & `attendances`).

### 5.3 Generate Kode Surat & Dokumen Outgoing
Service `LetterService.Create` (outgoing dari `LetterTemplate`):
1. Ambil `LetterTemplate` + kategori-nya (`category_id` dari template).
2. Lock row `letter_categories`; hitung nomor berikutnya dari `current_number` / `start_number`.
3. Render `number_format_template` → nilai default `{NOMOR_SURAT}` / `letter_code`. Placeholder template: `{number}`, `{number_padded}`, `{number_padded_2}`, `{number_padded_4}`, `{code}`, `{name}`, `{year}`, `{year_short}`, `{month}`, `{month_padded}`, `{month_roman}`, `{month_name}`, `{day}`, `{day_padded}`, `{date}`, `{date_id}`, `{weekday}`, `{weekday_short}` plus alias Indonesia (`{nomor}`, `{kategori}`, `{nama_kategori}`, `{tahun}`, `{bulan}`, `{bulan_romawi}`, `{bulan_nama}`, `{hari}`, `{tanggal}`, `{hari_nama}`, dll.). Jika user mengisi override `variables.NOMOR_SURAT` (atau `letter_code`), pakai nilai itu; counter tetap di-increment.
4. Simpan letter + `variable_values` (JSON map placeholder → teks).
5. Unduh `.docx` dari `letter_templates.template_url`, `letterdoc.DetectVariables` + `Merge` dengan map variabel user, upload ke `letters/{id}/generated.docx`, set `document_url`.
6. **Incoming:** set `document_url` dari upload (tanpa merge).
7. **Update file:** setelah create, admin boleh ganti `document_url` (upload file baru) tanpa regenerate wajib.

`GET /api/letters/:id/download` mengarahkan ke `document_url`.
`GET /api/letter_templates/:id/variables` → `{ variables: ["NOMOR_SURAT", ...] }`.

### 5.4 Role Permission Matrix (bulk grant/revoke)
Admin panel `Role Permissions` punya dua tampilan: **Matrix** (default) dan **Tabel** (CRUD generate biasa). Matrix memanggil dua endpoint custom di `RolePermissionHandler` (bukan hasil generator, didaftarkan di `grit:routes:custom`):
- `GET /api/roles/:id/permissions` → `RolePermissionService.PermissionsMatrixForRole`: semua `permissions` (urut module/code) + `assigned_ids` untuk role tsb.
- `PUT /api/roles/:id/permissions` (body `{permission_ids: []}`) → `RolePermissionService.SyncPermissionsForRole`: **replace-all** dalam satu transaction (hapus seluruh `role_permissions` milik role, insert ulang set baru) — pola yang sama dengan `AnnouncementService.ReplaceAttachments`. Dipilih dibanding diff add/remove karena idempotent & lebih sederhana untuk relasi many-to-many kecil ini.
Digate dengan permission code `roles.edit` (bukan role string), Grit base Role `ADMIN` bypass seperti middleware `RequirePermission` lain.

**Admin panel UI gating** (`apps/admin`): sidebar, Quick Access, dan halaman resource/MyOrg memfilter menu berdasarkan permission code dari `GET /api/me/permissions` (AppRole user). Setiap resource mendeklarasikan `viewPermission` di `apps/admin/resources/*.ts`. Grit base Role `ADMIN` menerima semua code (`is_grit_admin: true`); `EDITOR` hanya melihat fitur sesuai AppRole-nya. Gate panel tetap `ADMIN`/`EDITOR` — `USER` tidak masuk admin app.

### 5.5 Notifikasi
Pakai `asynq` job async agar request utama tetap cepat:
- Hasil import user → email berisi kredensial (opsional, bisa dimatikan via settings).
- Approval/rejection perizinan → notifikasi in-app + email ke user pengaju.
- **Announcement baru** → job `announcement:notify`:
  1. Resolve penerima (`target_type=all` → semua user aktif; `division` → user di divisi tersebut).
  2. Buat baris `notifications` (`source=announcement`) per user → tampil di bell web/admin.
  3. Kirim **Web Push** ke `push_subscriptions` browser yang sudah subscribe (PWA).

**PWA (apps/web):**
- `app/manifest.ts` + icons di `public/icons/` — installable di home screen.
- `public/sw.js` — handle `push` + `notificationclick` → buka `/announcements`.
- Endpoint auth: `GET /api/push/vapid-public-key`, `POST/DELETE /api/push/subscribe`.
- Env: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto:…). Generate: `go run` helper atau `npx web-push generate-vapid-keys`.
- **Syarat browser:** HTTPS (atau localhost). iOS butuh “Add to Home Screen” dulu.

Model `PushSubscription`: `user_id`, `endpoint` (unique), `p256dh`, `auth`.

### 5.6 Visibility Divisi
Query event & data lain memakai filter di service layer:
```
if !user.role.HasPermission("events.view_all") && !settings.AllowCrossDivisionEventsView {
    query = query.Where("division_id = ? OR division_id IS NULL", user.DivisionID)
}
```

### 5.7 Organization Settings Singleton
`OrganizationSettingService` enforce max 1 row (create kedua ditolak; update selalu ke row yang ada).

### 5.8 User Import
`UserImportService`: parse CSV/XLSX, validasi baris, bulk insert, kirim kredensial via asynq email.

## 6. Seed Data (`grit seed`)

Seed awal mencakup:
- 1 user Admin default + role `Admin` (custom role `is_system: true` dengan semua permission).
- Daftar `permissions` lengkap sesuai §4.
- 1 `organization_settings` row default (singleton).
- Contoh `letter_categories` (`UND`, `SK`).
- Divisi demo + admin user terhubung ke Role Admin + divisi.

## 7. Penyesuaian Manual di Luar Generator Default

Beberapa hal tidak bisa full-generate dan perlu ditulis manual, didokumentasikan di sini agar tidak dianggap "bug generator":
1. Unique composite index `(event_id, user_id)` di tabel `attendances`.
2. Tipe kolom JSON untuk `recruitment_submissions.custom_answers` (pakai `datatypes.JSON` GORM, bukan field generator string biasa).
3. Middleware `RequirePermission` untuk custom RBAC (§4).
4. Endpoint publik recruitment & settings branding (§3).
5. Service `LetterService` untuk counter surat (§5.3) — tidak lewat handler generate default.
6. Cron job transisi status event (§5.1).
7. Extend User model: `Username`, `FullName`, `AppRoleID`, dsb. (§2.3).

## 8. File Storage Layout (S3/MinIO bucket)

```
avatars/{user_id}/{timestamp}.jpg
attendance/selfies/{event_id}/{user_id}.jpg
attendance/signatures/{event_id}/{user_id}.png
permissions/proofs/{permission_request_id}.{ext}
violations/documents/{violation_id}.{ext}
recruitments/{recruitment_id}/attachments/...
letters/{letter_id}/generated.docx
letter-templates/{template_id}/template.docx
announcements/{announcement_id}/{filename}
settings/logo.{ext}
settings/icon.{ext}
```

## 9. Observability & Keamanan

- **Sentinel** diaktifkan untuk rate-limit endpoint publik (`/public/recruitment/*`, `/auth/login`) mencegah brute force/spam submission.
- **Pulse** dipantau khusus untuk endpoint berat: `events/:id/recap` (aggregasi banyak baris attendance) dan `users/import` (bulk insert).
- Semua endpoint upload file wajib validasi tipe MIME & ukuran max di service layer sebelum request presigned URL dikeluarkan.

## 10. Non-Goals / Di Luar Scope Saat Ini

- Tidak ada mobile app native di fase awal (mode `--mobile` bisa ditambahkan belakangan, API sudah siap dipakai bersama).
- Tidak ada multi-tenant (1 deployment = 1 organisasi), sesuai `organization_settings` yang didesain sebagai singleton.
- Demo resource `Blog` dihapus dari scaffold — tidak relevan ke PRD.

## 11. Keputusan Desain (ringkas)

| Topik | Keputusan |
|-------|-----------|
| Login identifier | PRD pakai `username`; extend auth Grit — support username (utama) + email |
| Login terpusat | Auth UI hanya di Web `:3000` (`/login`). Admin `:3001` mengalihkan ke web dengan `?next=` kembali ke panel. OAuth `OAUTH_FRONTEND_URL` → web `/auth/callback`. |
| User name fields | PRD `full_name` vs Grit `first_name/last_name` — tambah `FullName`, deprecate tampilan first/last di UI MyOrg |
| Dual role system | Grit `ADMIN/EDITOR/USER` untuk infra gate; custom `Role` + `Permission` untuk fitur bisnis (§4) |
| Shared package | Types/Zod di `packages/shared/` (hasil `grit sync`) |
| Blog demo | Dihapus — tidak relevan |
| Scope mobile | Di luar scope (§10) |
