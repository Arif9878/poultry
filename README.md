# Poultry Farm Management MVP

Vue 3 + TypeScript + Tailwind app untuk monitoring operasional peternakan ayam. Aplikasi frontend saat ini memakai **Supabase** untuk auth dan akses data, sementara schema di `supabase/schema.sql` sudah dibuat **portable** agar tetap bisa dijalankan di **Supabase** maupun **PostgreSQL biasa**.

## MVP yang tersedia

- Login email/password via Supabase Auth
- Dashboard KPI layer: total telur, total kg telur, rata-rata HD%, rata-rata FCR, total laba, stok pakan terakhir, perkiraan stok tersisa
- Setup master data: farm, kandang, dan flock
- Management pakan: item pakan, stok awal, harga pakan/kg, transaksi masuk/keluar/adjustment
- Laporan harian telur layer: total telur, kg telur, hen-day, FCR, biaya pakan, laba kotor
- Detail flock dengan KPI ringkas dan riwayat log
- Form log harian untuk layer dan broiler
- History log dengan filter farm, flock, dan tanggal
- Offline queue untuk daily log dengan status sync
- PWA installable untuk mobile dengan service worker auto-update

## Tech stack

- Vue 3
- Vue Router
- Tailwind CSS
- TypeScript
- Vite
- Supabase

## Menjalankan aplikasi

1. Install dependency

```bash
npm install
```

2. Copy env

```bash
cp .env.example .env
```

3. Isi `.env`

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

4. Jalankan schema `supabase/schema.sql`

5. Jalankan app

```bash
npm run dev
```

Build production:

```bash
npm run build
```

Setelah deploy, aplikasi bisa di-install ke home screen dari browser yang mendukung PWA.

## Deploy dengan Supabase

Mode ini adalah mode utama aplikasi saat ini.

1. Jalankan `supabase/schema.sql` di Supabase SQL Editor.
2. Jika project sudah pernah memakai schema lama, jalankan ulang file yang sama agar:
   - fix insert `flocks` untuk admin/manager ikut aktif
   - tabel `feed_items` dan `feed_transactions` ikut dibuat
   - kolom harga/target layer dan snapshot log harian ikut ditambahkan
   - view `layer_daily_log_metrics` ikut tersedia
   - trigger stok pakan dan policy RLS terbaru ikut aktif
3. Buat user di Supabase Auth. Contoh metadata:

```json
{
  "full_name": "Arif Admin",
  "phone": "081234567890",
  "role": "admin"
}
```

4. Setelah user pertama login, tambahkan data farm, kandang, flock, dan membership.

## Deploy schema ke PostgreSQL sendiri

`supabase/schema.sql` sekarang juga bisa dijalankan di PostgreSQL non-Supabase.

Yang sudah dibuat portable:

- tidak hard-depend ke `auth.users`
- tidak hard-depend ke `auth.uid()`
- trigger auto-profile dari `auth.users` hanya dibuat bila tabel itu memang ada
- RLS membaca user aktif dari session setting `app.current_user_id`

Contoh set auth context di PostgreSQL biasa:

```sql
select public.set_local_auth_context('00000000-0000-0000-0000-000000000001');
```

Atau:

```sql
select set_config('app.current_user_id', '00000000-0000-0000-0000-000000000001', false);
```

Pastikan user tersebut ada di `public.profiles`, karena role dan akses farm tetap dibaca dari:

- `public.profiles`
- `public.farm_memberships`

## Batasan mode PostgreSQL biasa

Portable schema **tidak berarti frontend ini bisa langsung login ke PostgreSQL biasa**. Saat ini frontend tetap mengandalkan:

- Supabase Auth
- Supabase client SDK
- environment variable `VITE_SUPABASE_URL`
- environment variable `VITE_SUPABASE_ANON_KEY`

Jadi mode PostgreSQL biasa cocok untuk:

- backend custom yang memakai schema domain yang sama
- migrasi / self-hosted PostgreSQL
- reporting atau integrasi server-side

Jika ingin frontend ini berjalan penuh tanpa Supabase, perlu layer API/auth pengganti di aplikasi.

## Struktur data

Schema membuat tabel utama berikut:

- `profiles`
- `farms`
- `farm_memberships`
- `flock_memberships`
- `houses`
- `flocks`
- `daily_logs`
- `feed_items`
- `feed_transactions`

Schema juga menambahkan:

- helper `public.current_app_user_id()`
- helper `public.set_local_auth_context(uuid)`
- trigger pembuatan profile dari `auth.users` bila tersedia
- trigger update `updated_at`
- trigger sinkronisasi populasi flock dari `daily_logs`
- trigger sinkronisasi stok `feed_items` dari `feed_transactions`
- view `layer_daily_log_metrics` untuk kalkulasi HD, FCR, kg telur, omzet, dan laba kotor
- RLS policy berbasis role, akses farm, dan akses flock

## Model akses

- `admin` tetap bisa akses semua data
- `farm_memberships` memberi akses ke semua flock dalam satu farm
- `flock_memberships` memberi akses hanya ke flock tertentu
- satu manager/operator bisa punya beberapa row `flock_memberships`, jadi bisa akses beberapa flock sekaligus meski lintas farm

## Modul utama

### Management pakan

- master item pakan per farm
- harga pakan / kg
- stok pakan awal
- transaksi pakan masuk, keluar, dan adjustment
- indikator low stock berdasarkan reorder level

### Laporan telur harian

- filter per farm dan periode
- hanya mengambil flock `layer`
- total telur
- total kg telur
- hen-day
- FCR
- biaya pakan
- laba kotor

### Field layer tambahan

- flock: `harga telur / kg`, `berat telur per butir`, `target HD%`, `batas FCR`, `safety stock`
- feed item: `harga pakan / kg`, `stok pakan awal`
- daily log: snapshot `harga pakan / kg`, `harga telur / kg`, `berat telur per butir`

## Offline behavior

- source of truth utama ada di Supabase
- saat browser offline, input daily log masuk ke local queue
- saat online kembali, queue akan di-push ke Supabase memakai `client_request_id`
- status `pending` dan `synced` tetap terlihat di UI

## Catatan

Repo ini tidak otomatis membuat seed operasional. Struktur domain, flow layar, dan metrik utama mengikuti RFC `poultry-farm-management-rfc.md`.
