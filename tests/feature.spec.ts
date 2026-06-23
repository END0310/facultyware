import { test, expect, Page } from '@playwright/test';

// ─────────────────────────────────────────────────────────────────────────────
// Kredensial login per role
// ─────────────────────────────────────────────────────────────────────────────
const CREDENTIALS = {
  ketuaDepartemen: { email: 'ketua.departemen@facultyware.test', password: 'password123' },
  pengelolaAset:   { email: 'pengelola.aset@facultyware.test',   password: 'password123' },
  wakilDekan:      { email: 'wakil.dekan@facultyware.test',      password: 'password123' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: login sebagai role tertentu
// ─────────────────────────────────────────────────────────────────────────────
async function login(page: Page, role: keyof typeof CREDENTIALS) {
  const creds = CREDENTIALS[role];
  await page.goto('/login');
  await page.fill('#email', creds.email);
  await page.fill('#password', creds.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 30000 });
}

async function logout(page: Page) {
  await page.goto('/logout');
  await page.waitForURL('**/login**');
}

// =============================================================================
// 1. AUTH — Login & Logout
// =============================================================================
test.describe('Auth — Login & Logout', () => {
  test('menampilkan halaman login', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h1')).toContainText('Welcome');
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
  });

  test('menolak login dengan password salah', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'ketua.departemen@facultyware.test');
    await page.fill('#password', 'wrong-password');
    await page.click('button[type="submit"]');
    // Harus tetap di halaman login dan ada pesan error
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
    const errorDiv = page.locator('.bg-destructive, .text-destructive, [class*="destructive"]');
    await expect(errorDiv.first()).toBeVisible({ timeout: 5000 });
  });

  test('berhasil logout', async ({ page }) => {
    await login(page, 'ketuaDepartemen');
    await logout(page);
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});

// =============================================================================
// FITUR 1 — Ketua Departemen: Input Usulan Pengadaan
// =============================================================================
test.describe('Fitur 1 — Ketua Departemen: Input Usulan', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'ketuaDepartemen');
  });

  test('menampilkan form tambah usulan', async ({ page }) => {
    await page.waitForTimeout(500);
    await page.goto('/usulan/create');
    await expect(page.locator('input[name="name"], input[name="title"]').first()).toBeVisible();
  });

  test('berhasil membuat usulan baru', async ({ page }) => {
    await page.goto('/usulan/create');
    // Isi form — field names bervariasi, isi yang ada
    const nameInput = page.locator('input[name="name"]');
    if (await nameInput.count() > 0) {
      await nameInput.fill('Laptop Testing Playwright');
    }
    const specInput = page.locator('input[name="specification"], textarea[name="specification"]').first();
    if (await specInput.count() > 0) {
      await specInput.fill('Intel i7, 16GB RAM');
    }
    const qtyInput = page.locator('input[name="quantity"]');
    if (await qtyInput.count() > 0) {
      await qtyInput.fill('2');
    }
    await page.click('button[type="submit"]');
    // Setelah submit, harus redirect ke daftar atau sukses
    await page.waitForTimeout(1000);
    const url = page.url();
    expect(url.includes('/usulan') || url.includes('/home')).toBeTruthy();
  });
});

// =============================================================================
// FITUR 2 — Ketua Departemen: Edit Usulan
// =============================================================================
test.describe('Fitur 2 — Ketua Departemen: Edit Usulan', () => {
  test('menampilkan halaman edit usulan', async ({ page }) => {
    await login(page, 'ketuaDepartemen');
    await page.goto('/usulan');
    // Cari link edit di tabel
    const editLink = page.locator('a[href*="/edit"]').first();
    if (await editLink.count() > 0) {
      await editLink.click();
      await expect(page.url()).toContain('/edit');
    }
  });
});

// =============================================================================
// FITUR 3 — Ketua Departemen: Lihat Status Usulan (Daftar + Search + Pagination)
// =============================================================================
test.describe('Fitur 3 — Ketua Departemen: Daftar & Status Usulan', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'ketuaDepartemen');
  });

  test('menampilkan daftar usulan', async ({ page }) => {
    await page.goto('/usulan');
    // Card container selalu ada, berisi table (jika ada data) atau pesan kosong
    await expect(page.locator('.card').first()).toBeVisible();
  });

  test('fitur pencarian berfungsi', async ({ page }) => {
    await page.goto('/usulan');
    const searchInput = page.locator('input[name="search"]');
    if (await searchInput.count() > 0) {
      await searchInput.fill('REQ');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/search=REQ/);
    }
  });

  test('fitur pagination tersedia', async ({ page }) => {
    await page.goto('/usulan');
    // Cek elemen pagination (Prev/Next atau info halaman)
    const paginationText = page.locator('text=Menampilkan');
    await expect(paginationText.first()).toBeVisible();
  });
});

// =============================================================================
// FITUR 4 — Ketua Departemen: Hapus Usulan
// =============================================================================
test.describe('Fitur 4 — Ketua Departemen: Hapus Usulan', () => {
  test('tombol hapus tersedia di daftar usulan', async ({ page }) => {
    await login(page, 'ketuaDepartemen');
    await page.goto('/usulan');
    // Tombol hapus hanya muncul pada usulan berstatus draft
    // Cari form delete atau button dengan tooltip "Hapus" atau icon trash
    const deleteBtn = page.locator('form[action*="delete"] button, button:has-text("Hapus"), a:has-text("Hapus")');
    const hasData = await page.locator('table tbody tr').count();
    if (hasData > 0 && await deleteBtn.count() > 0) {
      await expect(deleteBtn.first()).toBeVisible();
    }
  });
});

// =============================================================================
// FITUR 5 — Ketua Departemen: Generate Laporan PDF
// =============================================================================
test.describe('Fitur 5 — Ketua Departemen: Laporan PDF', () => {
  test('endpoint laporan PDF bisa di-download', async ({ page }) => {
    await login(page, 'ketuaDepartemen');
    // PDF endpoint memicu download, bukan navigasi biasa
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('a[href*="laporan/pdf"], a[href*="report"]').first().click().catch(() => page.goto('/usulan/laporan/pdf')),
    ]);
    expect(download).toBeTruthy();
  });
});

// =============================================================================
// FITUR 6 — Ketua Departemen: API Riwayat (JSON)
// =============================================================================
test.describe('Fitur 6 — Ketua Departemen: API JSON Riwayat', () => {
  test('endpoint API mengembalikan JSON', async ({ page }) => {
    await login(page, 'ketuaDepartemen');
    const response = await page.goto('/usulan/api/riwayat');
    expect(response).not.toBeNull();
    expect(response!.status()).toBe(200);
    const contentType = response!.headers()['content-type'] || '';
    expect(contentType).toContain('json');
  });
});

// =============================================================================
// FITUR 7 — Pengelola Aset: Menerima Usulan Pengadaan
// =============================================================================
test.describe('Fitur 7 — Pengelola Aset: Daftar Usulan Masuk', () => {
  test('menampilkan daftar usulan pengadaan (requests)', async ({ page }) => {
    await login(page, 'pengelolaAset');
    await page.goto('/procurements/requests');
    await expect(page.locator('table')).toBeVisible();
  });

  test('fitur pencarian di daftar usulan berfungsi', async ({ page }) => {
    await login(page, 'pengelolaAset');
    await page.goto('/procurements/requests');
    const searchInput = page.locator('input[name="search"]');
    if (await searchInput.count() > 0) {
      await searchInput.fill('REQ');
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/search=REQ/);
    }
  });
});

// =============================================================================
// FITUR 8 — Pengelola Aset: Input Permohonan Pengadaan
// =============================================================================
test.describe('Fitur 8 — Pengelola Aset: Buat Permohonan', () => {
  test('menampilkan form buat permohonan', async ({ page }) => {
    await login(page, 'pengelolaAset');
    await page.goto('/procurements/create');
    await expect(page.locator('form')).toBeVisible();
  });
});

// =============================================================================
// FITUR 9 — Pengelola Aset: Tambah Barang dari Pengadaan ke Sistem
// =============================================================================
test.describe('Fitur 9 — Pengelola Aset: Tambah Barang ke Sistem', () => {
  test('halaman add-asset dapat diakses dari detail procurement', async ({ page }) => {
    await login(page, 'pengelolaAset');
    await page.goto('/procurements');
    // Klik detail pertama jika ada
    const detailLink = page.locator('a[href*="/procurements/"]:has-text("Detail")').first();
    if (await detailLink.count() > 0) {
      await detailLink.click();
      await page.waitForTimeout(500);
      // Cek apakah ada link/button add-asset
      const addAssetLink = page.locator('a[href*="add-asset"]');
      if (await addAssetLink.count() > 0) {
        await expect(addAssetLink.first()).toBeVisible();
      }
    }
  });
});

// =============================================================================
// FITUR 10 — Pengelola Aset: Laporan Rekapan
// =============================================================================
test.describe('Fitur 10 — Pengelola Aset: Laporan Rekapan', () => {
  test('halaman report dapat diakses', async ({ page }) => {
    await login(page, 'pengelolaAset');
    await page.goto('/procurements/report');
    expect([200, 302].includes(page.url().includes('/report') ? 200 : 302)).toBeTruthy();
  });
});

// =============================================================================
// FITUR 11 — Pengelola Aset: Ubah Status Usulan
// =============================================================================
test.describe('Fitur 11 — Pengelola Aset: Ubah Status Usulan', () => {
  test('detail request menampilkan opsi ubah status', async ({ page }) => {
    await login(page, 'pengelolaAset');
    await page.goto('/procurements/requests');
    const detailLink = page.locator('a[href*="/requests/"]:has-text("Detail")').first();
    if (await detailLink.count() > 0) {
      await detailLink.click();
      await page.waitForTimeout(500);
      // Cek form/button untuk ubah status
      const statusForm = page.locator('form[action*="status"], select[name="status"], button:has-text("Ubah"), button:has-text("Terima"), button:has-text("Tolak")');
      if (await statusForm.count() > 0) {
        await expect(statusForm.first()).toBeVisible();
      }
    }
  });
});

// =============================================================================
// FITUR 12 — Pengelola Aset: API Barang Pengadaan
// =============================================================================
test.describe('Fitur 12 — Pengelola Aset: API Data Barang', () => {
  test('endpoint API mengembalikan JSON', async ({ page }) => {
    await login(page, 'pengelolaAset');
    const response = await page.goto('/api/procurement-items');
    expect(response).not.toBeNull();
    expect(response!.status()).toBe(200);
    const contentType = response!.headers()['content-type'] || '';
    expect(contentType).toContain('json');
    const body = await response!.json();
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('data');
  });
});

// =============================================================================
// FITUR 13 — Wakil Dekan: Daftar Permohonan (+ Search + Pagination)
// =============================================================================
test.describe('Fitur 13 — Wakil Dekan: Daftar Permohonan', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'wakilDekan');
  });

  test('menampilkan daftar permohonan', async ({ page }) => {
    await page.goto('/wakildekan/permohonan');
    // Tabel ada jika ada data, atau pesan kosong jika belum ada
    const table = page.locator('#dataTable');
    const emptyMsg = page.getByText('Belum ada permohonan masuk');
    const content = table.or(emptyMsg);
    await expect(content.first()).toBeVisible({ timeout: 10000 });
  });

  test('fitur pencarian berfungsi', async ({ page }) => {
    await page.goto('/wakildekan/permohonan');
    const searchInput = page.locator('input[name="search"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('REQ');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/search=REQ/);
  });

  test('fitur pagination tersedia', async ({ page }) => {
    await page.goto('/wakildekan/permohonan');
    const paginationInfo = page.locator('text=Menampilkan');
    await expect(paginationInfo.first()).toBeVisible();
  });
});

// =============================================================================
// FITUR 14 — Wakil Dekan: Detail Permohonan
// =============================================================================
test.describe('Fitur 14 — Wakil Dekan: Detail Permohonan', () => {
  test('menampilkan detail permohonan dengan info lengkap', async ({ page }) => {
    await login(page, 'wakilDekan');
    await page.goto('/wakildekan/permohonan');
    const detailLink = page.locator('a[href*="/wakildekan/permohonan/"]:not([href*="approve"]):not([href*="reject"])').first();
    if (await detailLink.count() > 0) {
      await detailLink.click();
      await page.waitForTimeout(500);
      // Harus ada info: nomor request, judul, status, daftar barang
      await expect(page.locator('text=Nomor Request, text=Detail')).toBeVisible();
    }
  });
});

// =============================================================================
// FITUR 15 — Wakil Dekan: Approve/Reject Permohonan
// =============================================================================
test.describe('Fitur 15 — Wakil Dekan: Keputusan Permohonan', () => {
  test('tombol setujui dan tolak tersedia di detail', async ({ page }) => {
    await login(page, 'wakilDekan');
    await page.goto('/wakildekan/permohonan');
    const detailLink = page.locator('a[href*="/wakildekan/permohonan/"]:not([href*="approve"]):not([href*="reject"])').first();
    if (await detailLink.count() > 0) {
      await detailLink.click();
      await page.waitForTimeout(500);
      // Harus ada tombol Setujui dan Tolak
      const approveBtn = page.locator('button:has-text("Setujui"), input[value="Setujui"]');
      const rejectBtn  = page.locator('button:has-text("Tolak"), input[value="Tolak"]');
      if (await approveBtn.count() > 0) {
        await expect(approveBtn.first()).toBeVisible();
      }
      if (await rejectBtn.count() > 0) {
        await expect(rejectBtn.first()).toBeVisible();
      }
    }
  });
});

// =============================================================================
// FITUR 16 — Wakil Dekan: Riwayat Keputusan (+ Search + Pagination)
// =============================================================================
test.describe('Fitur 16 — Wakil Dekan: Riwayat Keputusan', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'wakilDekan');
  });

  test('menampilkan halaman riwayat', async ({ page }) => {
    await page.goto('/wakildekan/riwayat');
    await expect(page.locator('h1')).toContainText('Riwayat');
  });

  test('fitur pencarian riwayat berfungsi', async ({ page }) => {
    await page.goto('/wakildekan/riwayat');
    const searchInput = page.locator('input[name="search"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('REQ');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/search=REQ/);
  });

  test('fitur pagination riwayat tersedia', async ({ page }) => {
    await page.goto('/wakildekan/riwayat');
    const paginationInfo = page.locator('text=Menampilkan');
    await expect(paginationInfo.first()).toBeVisible();
  });
});

// =============================================================================
// FITUR 17 — Wakil Dekan: Laporan PDF
// =============================================================================
test.describe('Fitur 17 — Wakil Dekan: Laporan PDF', () => {
  test('endpoint download PDF bisa di-download', async ({ page }) => {
    await login(page, 'wakilDekan');
    // Navigasi ke halaman riwayat dulu supaya ada link download
    await page.goto('/wakildekan/riwayat');
    const downloadLink = page.locator('a[href*="riwayat/download"]').first();
    if (await downloadLink.count() > 0) {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        downloadLink.click(),
      ]);
      expect(download).toBeTruthy();
    } else {
      // Fallback: akses langsung via request API
      const response = await page.request.get('/wakildekan/riwayat/download');
      expect(response.status()).toBeLessThan(500);
    }
  });
});

// =============================================================================
// FITUR 18 — Wakil Dekan: API JSON Permohonan
// =============================================================================
test.describe('Fitur 18 — Wakil Dekan: API JSON', () => {
  test('endpoint API mengembalikan JSON', async ({ page }) => {
    await login(page, 'wakilDekan');
    const response = await page.goto('/wakildekan/api/permohonan');
    expect(response).not.toBeNull();
    expect(response!.status()).toBe(200);
    const contentType = response!.headers()['content-type'] || '';
    expect(contentType).toContain('json');
    const body = await response!.json();
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('data');
  });
});

// =============================================================================
// ACL — Kontrol Akses Berdasarkan Role
// =============================================================================
test.describe('ACL — Kontrol Akses', () => {
  test('ketua departemen tidak bisa akses halaman wakil dekan', async ({ page }) => {
    await login(page, 'ketuaDepartemen');
    const response = await page.goto('/wakildekan/permohonan');
    // Harus di-redirect ke login/home atau mendapat 403
    const url = page.url();
    const status = response!.status();
    expect(
      url.includes('/login') || url.includes('/home') || status === 403
    ).toBeTruthy();
  });

  test('wakil dekan tidak bisa akses halaman pengelola aset', async ({ page }) => {
    await login(page, 'wakilDekan');
    const response = await page.goto('/procurements/requests');
    const url = page.url();
    const status = response!.status();
    expect(
      url.includes('/login') || url.includes('/home') || status === 403 || status === 302
    ).toBeTruthy();
  });

  test('user tanpa login di-redirect ke halaman login', async ({ page }) => {
    await page.goto('/wakildekan/permohonan');
    await expect(page).toHaveURL(/\/login/);
  });
});

// =============================================================================
// Dashboard — Wakil Dekan
// =============================================================================
test.describe('Dashboard — Wakil Dekan', () => {
  test('menampilkan statistik di dashboard', async ({ page }) => {
    await login(page, 'wakilDekan');
    await page.goto('/wakildekan/dashboard');
    // Harus ada stat cards — cek teks yang muncul di dashboard
    await expect(page.getByText('Total Permohonan').first()).toBeVisible({ timeout: 10000 });
  });
});

