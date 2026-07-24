# Deploy Production — Subdomain (Web / Admin / API terpisah)

Pola deploy Himatris / Heroflow: tiga subdomain berbeda memanggil satu API.

| Service | Contoh URL |
|---------|------------|
| Web | `https://himatris.heroflow.my.id` |
| Admin | `https://admin-himatris.heroflow.my.id` |
| API | `https://api-himatris.heroflow.my.id` |

## Env wajib

```bash
APP_ENV=production
APP_URL=https://api-himatris.heroflow.my.id
API_URL=https://api-himatris.heroflow.my.id
NEXT_PUBLIC_WEB_URL=https://himatris.heroflow.my.id
NEXT_PUBLIC_ADMIN_URL=https://admin-himatris.heroflow.my.id
OAUTH_FRONTEND_URL=https://himatris.heroflow.my.id
CORS_ORIGINS=https://himatris.heroflow.my.id,https://admin-himatris.heroflow.my.id
AUTH_COOKIE_DOMAIN=.heroflow.my.id
```

`APP_URL` dan `API_URL` harus **host yang sama** (hindari typo `api.` vs `api-`).

## Rebuild frontend

`NEXT_PUBLIC_*` di-bake saat build Docker / `pnpm build`:

```bash
docker compose -f docker-compose.prod.yml build --no-cache web admin
docker compose -f docker-compose.prod.yml up -d
```

## Masalah umum

### Link Web → Admin jadi `:3001` di domain web

Build masih memakai `localhost:3001`. Helper `resolvePublicAppUrl` **tidak** lagi menambah port dev di HTTPS subdomain — rebuild dengan `NEXT_PUBLIC_ADMIN_URL` benar.

### Logout admin 403 (CSRF)

Admin & API beda subdomain: cookie `grit_csrf` harus pakai `AUTH_COOKIE_DOMAIN=.heroflow.my.id` agar JS admin bisa baca token CSRF. Set env di API, restart API, login ulang.

### API masih `localhost:8080` di browser

Rebuild web/admin dengan `API_URL` production.
