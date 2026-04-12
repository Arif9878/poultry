# RFC: Aplikasi Manajemen Peternakan Ayam (MVP)

## 1. Problem Statement

Peternak ayam skala kecil hingga menengah di Indonesia masih banyak mengandalkan pencatatan manual lewat buku, spreadsheet sederhana, atau chat. Akibatnya:

- pemakaian pakan sulit dipantau secara konsisten
- angka kematian sering terlambat diketahui polanya
- populasi aktual tidak selalu tercatat rapi
- produksi telur pada layer sulit dianalisis per hari
- pertumbuhan bobot pada broiler tidak terpantau dengan baik
- owner/manajer kesulitan mendapat ringkasan operasional harian

Aplikasi ini ditujukan untuk membantu monitoring harian, mengurangi loss, dan menyederhanakan operasional kandang melalui pencatatan mobile-first yang cepat dan praktis.

---

## 2. Goals and Non-Goals

### Goals

- Memudahkan pencatatan operasional harian peternakan ayam.
- Mendukung kebutuhan utama farm **layer** dan **broiler**.
- Menyediakan dashboard sederhana untuk monitoring performa kandang/flock.
- Membantu deteksi dini masalah seperti kenaikan mortalitas atau penurunan produksi.
- Mendukung penggunaan di lapangan dengan koneksi internet tidak stabil.
- Menjadi sistem yang cukup ringan untuk dipakai harian oleh operator kandang.

### Non-Goals

- Sistem ERP atau akuntansi lengkap.
- Manajemen pembelian, supplier, dan gudang yang kompleks.
- Diagnosis penyakit otomatis.
- Integrasi IoT/sensor pada MVP.
- Sistem marketplace atau penjualan hasil ternak.
- Fitur enterprise yang kompleks seperti multi-company hierarchy.

---

## 3. User Personas

### 1. Owner / Farm Manager
**Profil:** Pemilik atau pengelola beberapa kandang/farm.  
**Kebutuhan:**
- melihat kondisi farm secara cepat
- membandingkan performa antar kandang/flock
- mendeteksi potensi kerugian lebih awal
- mengakses ringkasan operasional tanpa menunggu laporan manual

### 2. Operator / Supervisor Kandang
**Profil:** Orang lapangan yang mencatat data harian.  
**Kebutuhan:**
- input data cepat dan sederhana
- bisa dipakai dari HP Android
- tetap bisa digunakan saat sinyal lemah
- minim langkah dan minim pengetikan

### 3. Admin / Staff Back Office
**Profil:** Mengelola data master dan membantu pelaporan.  
**Kebutuhan:**
- membuat farm, kandang, dan flock
- mengelola user dan akses
- menarik data dasar untuk pelaporan

---

## 4. Key Use Cases

1. Mencatat pakan harian per flock/kandang.
2. Mencatat jumlah kematian harian.
3. Memantau populasi hidup saat ini.
4. Mencatat produksi telur untuk flock layer.
5. Mencatat bobot sampel untuk flock broiler.
6. Menulis daily log terkait kondisi lapangan.
7. Melihat dashboard performa harian dan tren singkat.
8. Melihat histori log per flock.
9. Menginput data saat offline dan menyinkronkan saat online kembali.

---

## 5. Functional Requirements

### 5.1 Master Data
Sistem harus menyediakan data master berikut:

- **Farm**
- **Kandang / House**
- **Flock / Batch**
- **User**
- **Farm assignment**

Setiap flock minimal memiliki:
- tipe flock: `layer` atau `broiler`
- tanggal mulai
- populasi awal
- status aktif/nonaktif
- kandang terkait

### 5.2 Daily Log
Operator harus bisa mengisi log harian per flock dengan field inti:

#### Umum
- tanggal
- pakan dipakai (kg)
- mortalitas (ekor)
- populasi hidup
- catatan harian

#### Layer
- jumlah telur
- opsional: telur pecah / reject

#### Broiler
- rata-rata bobot sampel
- jumlah sampel

### 5.3 Dashboard
Sistem harus menampilkan ringkasan:

- total feed hari ini
- mortalitas hari ini
- populasi hidup
- produksi telur harian untuk layer
- bobot rata-rata untuk broiler
- tren 7 hari terakhir

### 5.4 KPI Sederhana
Sistem harus menghitung:

- mortality rate
- feed per bird
- hen-day production % untuk layer
- average sample weight untuk broiler

### 5.5 Authentication and Authorization
- login dengan email/nomor HP + password
- role minimal:
  - admin
  - manager
  - operator
- user hanya bisa mengakses farm yang ditugaskan

### 5.6 Offline Support
- operator dapat menyimpan log saat offline
- data offline masuk ke local storage
- sistem menyinkronkan otomatis saat koneksi kembali
- status sync harus terlihat oleh user

---

## 6. Non-Functional Requirements

### Performance
- halaman dashboard terbuka < 3 detik pada koneksi normal
- submit daily log terasa instan di sisi user
- endpoint inti target p95 < 500 ms untuk beban MVP

### Reliability
- data yang sudah tersimpan tidak boleh hilang
- API write harus idempotent untuk mendukung retry sync
- setiap record penting memiliki audit field:
  - `created_at`
  - `updated_at`
  - `created_by`

### Offline Support
- user tetap bisa:
  - membuka flock aktif
  - mengisi log harian
  - melihat data lokal terbaru
- cache lokal tetap tersedia setelah app ditutup

### Security
- semua endpoint memakai authentication
- authorization berbasis role dan farm access
- password disimpan dalam bentuk hash
- komunikasi memakai HTTPS

### Maintainability
- arsitektur modular
- API versioned dari awal (`/api/v1`)
- struktur data cukup fleksibel untuk layer dan broiler

---

## 7. System Design

### High-Level Architecture

```text
Android App / Mobile Client
        |
        | HTTPS / JSON
        v
Backend API
  - Auth Module
  - Farm Module
  - Flock Module
  - Daily Log Module
  - KPI / Dashboard Module
        |
        v
PostgreSQL Database
        |
        +-- Optional local/offline sync queue on mobile
```

### Design Principles

- **mobile-first**
- fokus pada **daily operations**
- simpan **raw data operasional** terlebih dahulu
- hitung KPI dari data harian
- pisahkan data master dan data transaksi

### Recommended Deployment
- mobile app untuk operator
- backend API terpusat
- database PostgreSQL
- web admin opsional setelah MVP stabil

---

## 8. Data Model

### Entities

#### User
- id
- name
- phone
- email
- password_hash
- role
- status

#### Farm
- id
- name
- location
- owner_user_id

#### House
- id
- farm_id
- name
- capacity

#### Flock
- id
- farm_id
- house_id
- type (`layer` / `broiler`)
- start_date
- initial_population
- current_population
- strain
- supplier
- status

#### DailyLog
- id
- flock_id
- log_date
- feed_used_kg
- mortality_count
- live_population
- notes
- created_by
- sync_status

#### EggProduction
- id
- daily_log_id
- egg_count
- broken_egg_count
- reject_egg_count

#### WeightRecord
- id
- daily_log_id
- avg_weight_gram
- sample_count

#### HealthEvent
- id
- flock_id
- event_date
- event_type
- note

### Relationships

- satu **Farm** punya banyak **House**
- satu **House** punya banyak **Flock**
- satu **Flock** punya banyak **DailyLog**
- satu **DailyLog** bisa punya satu **EggProduction**
- satu **DailyLog** bisa punya satu **WeightRecord**
- satu **Flock** punya banyak **HealthEvent**
- satu **User** bisa di-assign ke satu atau lebih **Farm**

---

## 9. API Design

### Auth
```http
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/me
```

### Farm and Flock
```http
GET    /api/v1/farms
POST   /api/v1/farms
GET    /api/v1/farms/:farmId/houses
POST   /api/v1/farms/:farmId/houses
GET    /api/v1/flocks
POST   /api/v1/flocks
GET    /api/v1/flocks/:flockId
PATCH  /api/v1/flocks/:flockId
```

### Daily Log
```http
GET    /api/v1/flocks/:flockId/daily-logs
POST   /api/v1/flocks/:flockId/daily-logs
GET    /api/v1/daily-logs/:logId
PATCH  /api/v1/daily-logs/:logId
```

### Dashboard
```http
GET /api/v1/dashboard/summary?farm_id=123&date=2026-04-11
GET /api/v1/flocks/:flockId/kpis
GET /api/v1/flocks/:flockId/trends?period=7d
```

### Sync
```http
POST /api/v1/sync/daily-logs/bulk
```

### Example Payload: Create Daily Log
```json
{
  "log_date": "2026-04-11",
  "feed_used_kg": 120.5,
  "mortality_count": 6,
  "live_population": 4920,
  "notes": "Cuaca panas, konsumsi air naik",
  "egg_production": {
    "egg_count": 4380,
    "broken_egg_count": 24,
    "reject_egg_count": 8
  },
  "weight_record": null,
  "client_request_id": "uuid-mobile-123"
}
```

---

## 10. Risks and Tradeoffs

| Area | Risk / Tradeoff | Mitigation |
|---|---|---|
| Scope | Mendukung layer dan broiler sekaligus bisa memperlebar scope | Pakai model daily log bersama, field spesifik dibuat opsional |
| Adoption | Operator malas input jika form terlalu panjang | Form dibuat singkat, numerik, dan satu layar utama |
| Offline | Konflik data saat sync | Gunakan idempotency key dan tampilkan status sync |
| Data quality | Input tidak akurat atau terlambat | Wajibkan field inti dan beri validasi sederhana |
| Delivery speed | Web + mobile sekaligus memperlambat | Fokus Android/mobile-first, web opsional |
| Analytics | KPI kompleks dapat menghambat MVP | Mulai dari KPI dasar dan tren 7 hari |

---

## 11. Rollout Plan

### Phase 1: Pilot
- uji coba di 2–3 farm
- minimal 1 farm layer dan 1 farm broiler
- fokus pada kestabilan input harian dan sync

### Phase 2: Stabilization
- perbaikan UX form
- perbaikan kualitas data
- penyempurnaan KPI dan dashboard

### Phase 3: Expansion
- tambah user/farm
- web admin opsional
- tambah alert sederhana jika memang dibutuhkan

---

# MVP Plan

## Core Features for MVP

Fitur yang harus masuk agar MVP benar-benar berguna di lapangan:

1. Login dan role-based access
2. Setup farm, kandang, dan flock
3. Daily log:
   - feed tracking
   - mortality
   - chicken population
   - daily notes
4. Egg production untuk layer
5. Weight tracking untuk broiler
6. Dashboard ringkas per farm/flock
7. Offline entry dan auto sync
8. Histori log sederhana

---

## Excluded from MVP

Yang sengaja tidak masuk agar tetap lean:

- akuntansi
- pembelian dan inventory kompleks
- manajemen obat dan stok detail
- WhatsApp/SMS alerts
- IoT sensor integration
- forecasting dan analitik lanjutan
- marketplace
- web dashboard penuh
- multi-tenant enterprise features

---

## User Flow

### A. Initial Setup
1. Admin membuat farm.
2. Admin membuat kandang.
3. Admin membuat flock aktif.
4. User operator di-assign ke farm tertentu.

### B. Daily Logging
1. Operator login dari HP Android.
2. Operator memilih flock aktif.
3. Operator mengisi log harian:
   - pakan
   - mortalitas
   - populasi hidup
   - telur atau bobot sampel
   - catatan
4. Operator menekan **Simpan**.
5. Jika online, data langsung sync.
6. Jika offline, data disimpan lokal dengan status **Pending Sync**.

### C. Review by Manager
1. Manager membuka dashboard.
2. Manager melihat ringkasan per flock/farm.
3. Manager mengecek anomali:
   - mortalitas naik
   - produksi telur turun
   - bobot tidak sesuai tren
4. Manager membuka histori log jika perlu.

---

## Simple UI/UX Concept

### Design Principles
- satu tugas utama per layar
- tombol besar dan mudah ditekan
- input angka dominan
- minim teks panjang
- bahasa Indonesia sederhana dan familiar

### Main Screens

#### 1. Login
- nomor HP/email
- password

#### 2. Home Dashboard
- daftar flock aktif
- KPI hari ini
- status sync

#### 3. Flock Detail
- info flock
- umur flock
- populasi saat ini
- tren 7 hari
- tombol **Isi Log Harian**

#### 4. Daily Log Form
- tanggal
- pakan
- mortalitas
- populasi hidup
- section khusus:
  - layer: produksi telur
  - broiler: bobot sampel
- catatan
- tombol simpan

#### 5. History
- daftar log sebelumnya
- status sync
- edit terbatas untuk log terbaru

---

## Tech Stack Recommendation

### Frontend
**Flutter**  
Alasan:
- cepat untuk Android-first
- UI mobile bagus
- mendukung local storage/offline dengan baik
- masih bisa dipakai ke web nanti jika perlu

### Backend
**NestJS (Node.js + TypeScript)**  
Alasan:
- struktur modular jelas
- cocok untuk REST API
- validasi dan auth relatif cepat dibangun
- produktif untuk MVP

### Database
**PostgreSQL**  
Alasan:
- relasional, cocok untuk data operasional
- stabil dan mudah dikembangkan
- bagus untuk query KPI dan laporan

### Mobile Local Storage
- SQLite
- sync queue dengan retry + idempotency key

### Hosting
- backend: Render / Railway / Fly.io / VPS kecil
- database: managed PostgreSQL

---

## Timeline (2–4 Weeks Sprint Plan)

| Week | Focus | Output |
|---|---|---|
| 1 | Foundation | auth, data model, farm/house/flock setup, app shell |
| 2 | Daily Logging | form log harian, layer/broiler fields, save local/offline |
| 3 | Dashboard & Sync | dashboard sederhana, KPI dasar, auto sync, history |
| 4 | Hardening & Pilot | bug fixing, role access, usability polish, pilot deployment |

### Lean 2-Week Version
Jika harus sangat cepat:
- Android only
- tanpa web
- dashboard sangat sederhana
- tanpa export
- fokus ke daily log + sync + KPI dasar

---

## Success Metrics (KPIs)

### Adoption
- **Daily logging rate**: persentase flock aktif yang mengisi log harian
- **Weekly active users**: operator/manager aktif per minggu
- **Time to submit log**: target < 2 menit per flock

### Data Quality
- **Completeness rate**: persentase log dengan field wajib lengkap
- **Sync success rate**: persentase log offline yang berhasil sync < 24 jam
- **Duplicate/conflict rate**: harus rendah

### Operational Impact
- **Feed tracking coverage**
- **Mortality monitoring consistency**
- **Egg/weight trend visibility**
- **Early issue detection**: masalah operasional terdeteksi lebih cepat dibanding sebelum aplikasi

---

## Recommended MVP Scope

Jika ingin versi paling realistis dan cepat dikirim, fokus pada:

1. Auth
2. Farm / kandang / flock setup
3. Daily log
4. Feed tracking
5. Mortality tracking
6. Population tracking
7. Egg production untuk layer
8. Weight tracking untuk broiler
9. Simple dashboard
10. Offline sync

Itu cukup lean untuk 2–4 minggu, tetapi sudah memberikan nilai nyata untuk operasional peternakan harian.
