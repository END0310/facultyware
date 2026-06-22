# Facultyware

Facultyware adalah aplikasi web sistem informasi pengadaan barang untuk lingkungan fakultas. Aplikasi ini membantu proses pengajuan usulan pengadaan barang oleh Ketua Departemen, pengelolaan permohonan oleh Pengelola Aset/Pengelola Sistem, serta proses persetujuan atau penolakan oleh Wakil Dekan.

Fitur utama aplikasi meliputi pengajuan usulan pengadaan, edit dan hapus usulan, pemantauan status usulan, pengelolaan permohonan pengadaan, penambahan barang hasil pengadaan ke sistem, dashboard tiap role, laporan rekapan, dan endpoint API JSON.

## Cara Instalasi

1. Pastikan Node.js dan MySQL sudah terpasang.

2. Masuk ke folder project:

   ```bash
   cd facultyware
   ```

3. Install dependency:

   ```bash
   npm install
   ```

4. Buat atau sesuaikan file `.env`:

   ```env
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=facultyware
   SESSION_SECRET=facultyware-secret
   PORT=3000
   ```

5. Buat database MySQL dengan nama sesuai `DB_NAME`.

6. Jalankan script inisialisasi atau seed database jika diperlukan:

   ```bash
   node scripts/init_db.js
   node scripts/seed_data.js
   ```

   Jika menggunakan seed SQL pengadaan, jalankan file:

   ```text
   database/seed_procurement_roles.sql
   ```

## Cara Menjalankan Aplikasi

Jalankan aplikasi dengan perintah:

```bash
npm start
```

Setelah server berjalan, buka aplikasi melalui browser:

```text
http://localhost:3000
```

Untuk mode development, gunakan:

```bash
npm run dev
```

## Pembagian Tugas Anggota

| No | Fitur | NIM | Nama Anggota |
| --- | --- | --- | --- |
| 1 | Ketua Departemen dapat menginputkan pengajuan usulan pengadaan barang | 2411521017 | Diva Ramadhani |
| 2 | Ketua Departemen dapat mengedit usulan pengadaan barang | 2411521017 | Diva Ramadhani |
| 3 | Ketua Departemen dapat melihat status usulan pengadaan barang | 2411521017 | Diva Ramadhani |
| 4 | Ketua Departemen dapat menghapus usulan pengadaan barang | 2411521017 | Diva Ramadhani |
| 5 | Ketua Departemen dapat mengenerate file laporan rekapan pengadaan barang | 2411521017 | Diva Ramadhani |
| 6 | Sistem dapat memberikan response semua riwayat pengajuan pengadaan barang oleh Ketua Departemen dalam format JSON (API) | 2411521017 | Diva Ramadhani |
| 7 | Ketua Departemen dapat melihat dashboard | 2411521017 | Diva Ramadhani |
| 8 | Pengelola sistem dapat menerima usulan pengadaan barang | 2411522006 | Kevin Rahmat Illahi |
| 9 | Pengelola Aset dapat menginputkan permohonan pengadaan barang | 2411522006 | Kevin Rahmat Illahi |
| 10 | Pengelola Aset dapat menambahkan data barang yang disetujui hasil dari pengadaan ke sistem | 2411522006 | Kevin Rahmat Illahi |
| 11 | Pengelola Aset dapat mengenerate file laporan rekapan pengadaan barang | 2411522006 | Kevin Rahmat Illahi |
| 12 | Pengelola Aset dapat merubah status usulan pengadaan barang | 2411522006 | Kevin Rahmat Illahi |
| 13 | Pengelola Aset dapat melihat data barang pengadaan melalui API | 2411522006 | Kevin Rahmat Illahi |
| 14 | Pengelola Aset dapat melihat dashboard | 2411522006 | Kevin Rahmat Illahi |
| 15 | Wakil Dekan dapat melihat daftar permohonan pengadaan barang | 2411522013 | Aldo Septia Elvawan |
| 16 | Wakil Dekan dapat melihat detail permohonan pengadaan barang | 2411522013 | Aldo Septia Elvawan |
| 17 | Wakil Dekan dapat memberikan keputusan persetujuan/penolakan permohonan pengadaan barang | 2411522013 | Aldo Septia Elvawan |
| 18 | Wakil Dekan dapat melihat riwayat keputusan permohonan pengadaan barang | 2411522013 | Aldo Septia Elvawan |
| 19 | Wakil Dekan dapat mengenerate file laporan rekapan pengadaan barang | 2411522013 | Aldo Septia Elvawan |
| 20 | Sistem dapat memberikan response data permohonan pengadaan barang dalam format JSON (API) | 2411522013 | Aldo Septia Elvawan |
| 21 | Wakil Dekan dapat melihat dashboard | 2411522013 | Aldo Septia Elvawan |
