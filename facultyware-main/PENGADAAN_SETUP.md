# Setup Modul Pengadaan Barang

## File penting
- `routes/procurements.js`
- `routes/apiProcurements.js`
- `controllers/procurementController.js`
- `controllers/apiProcurementController.js`
- `middlewares/auth.js`
- `middlewares/acl.js`
- `views/procurements/**`
- `database/seed_procurement_roles.sql`

## Cara menjalankan
1. Import `db_tb_pweb_v2.sql` ke MySQL.
2. Jalankan `database/seed_procurement_roles.sql` pada database `facultyware`.
3. Buat `.env`:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=facultyware
SESSION_SECRET=facultyware-secret
# Default MemoryStore agar tidak bentrok dengan tabel Laravel sessions.
USE_MYSQL_SESSION=false
```

4. Install dan jalankan:

```bash
npm install
npm start
```

5. Buka `http://localhost:3000/login`.

## Akun default
Semua password: `password123`

- Ketua Departemen: `ketua.departemen@facultyware.test`
- Pengelola Aset: `pengelola.aset@facultyware.test`
- Wakil Dekan: `wakil.dekan@facultyware.test`
- Admin: `admin@facultyware.test`

Form login bawaan masih memakai field `username`; isi dengan email akun di atas.

## Skenario test
1. Login sebagai Pengelola Aset atau Admin.
2. Buka `/procurements/requests`.
3. Detail salah satu usulan.
4. Ubah status usulan menjadi `approved`.
5. Klik buat permohonan dari usulan.
6. Simpan draft, lalu submit.
7. Login sebagai Wakil Dekan atau Admin.
8. Buka detail permohonan, klik approve placeholder.
9. Login kembali sebagai Pengelola Aset.
10. Tambahkan barang ke sistem aset.
11. Buka `/procurements/report`, lalu export CSV.
12. Test API:
    - `/api/procurements`
    - `/api/procurements/9001`
    - `/api/procurements/9001/items`
    - `/api/procurement-assets`
    - `/api/procurement-summary`

## Catatan database
Tidak ada `CREATE TABLE`, `ALTER TABLE`, `DROP TABLE`, atau penambahan kolom pada seed. Fitur dibuat memakai tabel yang sudah ada:
- `equipment_requests`
- `equipment_procurements`
- `equipment_proc_items`
- `assets`
- `equipments`
- `users`, `employees`, `roles`, `permissions`, `model_has_roles`, `role_has_permissions`

## Troubleshooting singkat
- `Unknown column 'data' in 'field list'`: gunakan `USE_MYSQL_SESSION=false`. Tabel `sessions` bawaan DB memakai `payload`, bukan `data`.
- FK error saat seed: pastikan `db_tb_pweb_v2.sql` sudah diimport penuh sebelum seed.
- Role tidak terbaca: logout-login ulang agar session role ter-refresh.
- Password tidak cocok: pastikan seed terbaru dijalankan; hash seed untuk `password123`.
- View not found: pastikan folder `views/procurements` ikut tersalin.
- Route not found: pastikan `app.js` sudah memuat `/procurements` dan `/api`.
