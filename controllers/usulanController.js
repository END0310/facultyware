const db = require("../lib/db");
const PDFDocument = require("pdfkit");

// ─────────────────────────────────────────────────────────────────────────────
// Helper: generate nomor request unik
// Format: REQ-YYYY-NNNNN
// ─────────────────────────────────────────────────────────────────────────────
async function generateRequestNumber() {
  const year = new Date().getFullYear();
  const prefix = `REQ-${year}-`;

  const [rows] = await db.query(
    `SELECT request_number FROM equipment_procurements
     WHERE request_number LIKE ?
     ORDER BY id DESC LIMIT 1`,
    [`${prefix}%`]
  );

  if (rows.length === 0) return `${prefix}00001`;

  const lastNum = parseInt(rows[0].request_number.replace(prefix, ""), 10);
  return `${prefix}${String(lastNum + 1).padStart(5, "0")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: format Rupiah
// ─────────────────────────────────────────────────────────────────────────────
function formatRupiah(amount) {
  if (!amount && amount !== 0) return "Rp 0";
  return "Rp " + parseFloat(amount).toLocaleString("id-ID");
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: label status Indonesia
// ─────────────────────────────────────────────────────────────────────────────
function statusLabel(status) {
  const map = {
    draft: "Draft",
    submitted: "Diajukan ke Wakil Dekan",
    approved: "Disetujui",
    rejected: "Ditolak",
    completed: "Selesai",
  };
  return map[status] || status;
}

function statusLabelForRequest(status, requestNumber) {
  const isAssetRequest = String(requestNumber || '').startsWith('REQ-');
  if (isAssetRequest && status === 'submitted') return 'Menunggu Pengelola Aset';
  if (isAssetRequest && status === 'rejected') return 'Ditolak Pengelola Aset';
  return statusLabel(status);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: ambil employee_id yang sesuai dengan user yang login
// ─────────────────────────────────────────────────────────────────────────────
async function getEmployeeId(userId) {
  const [rows] = await db.query(
    `SELECT id FROM employees WHERE id = ?`,
    [userId]
  );
  if (rows.length > 0) return rows[0].id;

  const [fallback] = await db.query(`SELECT id FROM employees LIMIT 1`);
  if (fallback.length > 0) return fallback[0].id;

  throw new Error(
    "Tidak ada data employee di database. Jalankan setup_database_lengkap.sql terlebih dahulu."
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FITUR 3 — Daftar & Status Usulan Milik User yang Login
// GET /usulan
// ─────────────────────────────────────────────────────────────────────────────
const index = async (req, res, next) => {
  try {
    const userId = req.session.userId;
    const employeeId = await getEmployeeId(userId);
    const search = String(req.query.search || '').trim();
    const page   = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit  = 10;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE ep.created_by = ?';
    const params = [employeeId];

    if (search) {
      whereClause += ' AND (ep.request_number LIKE ? OR ep.title LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like);
    }

    // Count total
    const [countRows] = await db.query(
      `SELECT COUNT(DISTINCT ep.id) AS total
       FROM equipment_procurements ep
       ${whereClause}`,
      params
    );
    const totalItems = countRows[0].total;
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    // Data with pagination
    const [procurements] = await db.query(
      `SELECT
         ep.id,
         ep.request_number,
         ep.title,
         ep.status,
         ep.created_at,
         ep.updated_at,
         COUNT(epi.id)                                        AS total_items,
         COALESCE(SUM(epi.quantity * epi.estimated_price), 0) AS total_estimasi
       FROM equipment_procurements ep
       LEFT JOIN equipment_proc_items epi ON ep.id = epi.equipment_proc_id
       ${whereClause}
       GROUP BY ep.id
       ORDER BY ep.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const successMessage = req.session.successMessage || null;
    const errorMessage   = req.session.errorMessage   || null;
    delete req.session.successMessage;
    delete req.session.errorMessage;

    res.render("usulan/index", {
      title: "Usulan Pengadaan Barang",
      user: req.session.username || null,
      procurements,
      formatRupiah,
      statusLabel,
      successMessage,
      errorMessage,
      search,
      currentPage: page,
      totalPages,
      totalItems,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// FITUR 1 — Form Input Usulan Baru
// GET /usulan/create
// ─────────────────────────────────────────────────────────────────────────────
const createPage = async (req, res, next) => {
  try {
    res.render("usulan/create", {
      title: "Buat Usulan Pengadaan",
      user: req.session.username || null,
      errors: [],
      old: {},
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// FITUR 1 — Simpan Usulan Baru
// POST /usulan
// ─────────────────────────────────────────────────────────────────────────────
const store = async (req, res, next) => {
  const userId = req.session.userId;

  const title  = req.body.title;
  const action = req.body.action;

  const item_names      = req.body["item_names[]"];
  const item_specs      = req.body["item_specs[]"];
  const item_quantities = req.body["item_quantities[]"];
  const item_prices     = req.body["item_prices[]"];

  const errors = [];
  if (!title || title.trim() === "") errors.push("Judul usulan wajib diisi.");

  const names      = Array.isArray(item_names)      ? item_names      : item_names      ? [item_names]      : [];
  const specs      = Array.isArray(item_specs)      ? item_specs      : item_specs      ? [item_specs]      : [];
  const quantities = Array.isArray(item_quantities) ? item_quantities : item_quantities ? [item_quantities] : [];
  const prices     = Array.isArray(item_prices)     ? item_prices     : item_prices     ? [item_prices]     : [];

  if (names.filter((n) => n && n.trim() !== "").length === 0) {
    errors.push("Minimal 1 item barang harus ditambahkan.");
  }

  if (errors.length > 0) {
    return res.render("usulan/create", {
      title: "Buat Usulan Pengadaan",
      user: req.session.username || null,
      errors,
      old: req.body,
    });
  }

  const status = action === "submit" ? "submitted" : "draft";

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const employeeId    = await getEmployeeId(userId);
    const requestNumber = await generateRequestNumber();

    const [result] = await connection.query(
      `INSERT INTO equipment_procurements
         (request_number, title, status, created_by, employee_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [requestNumber, title.trim(), status, employeeId, employeeId]
    );

    const procId = result.insertId;

    for (let i = 0; i < names.length; i++) {
      if (!names[i] || names[i].trim() === "") continue;
      const qty   = parseInt(quantities[i], 10) || 1;
      const price = parseFloat(prices[i])       || 0;
      await connection.query(
        `INSERT INTO equipment_proc_items
           (equipment_proc_id, name, specification, quantity, estimated_price,
            asset_equipment_procurement_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [procId, names[i].trim(), specs[i] || null, qty, price, procId]
      );
    }

    await connection.commit();

    const statusText = status === "submitted" ? "diajukan ke Pengelola Aset" : "disimpan sebagai draft";
    req.session.successMessage = `Usulan "${title.trim()}" berhasil ${statusText} (${requestNumber}).`;
    res.redirect("/usulan");
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// FITUR 2 — Form Edit Usulan (hanya status draft)
// GET /usulan/:id/edit
// ─────────────────────────────────────────────────────────────────────────────
const editPage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId     = req.session.userId;
    const employeeId = await getEmployeeId(userId);

    const [procRows] = await db.query(
      `SELECT * FROM equipment_procurements WHERE id = ? AND created_by = ?`,
      [id, employeeId]
    );

    if (procRows.length === 0) {
      req.session.errorMessage = "Usulan tidak ditemukan.";
      return res.redirect("/usulan");
    }

    if (procRows[0].status !== "draft") {
      req.session.errorMessage = "Hanya usulan berstatus 'draft' yang dapat diedit.";
      return res.redirect("/usulan");
    }

    const [items] = await db.query(
      `SELECT * FROM equipment_proc_items WHERE equipment_proc_id = ? ORDER BY id`,
      [id]
    );

    res.render("usulan/edit", {
      title: "Edit Usulan Pengadaan",
      user: req.session.username || null,
      procurement: procRows[0],
      items,
      errors: [],
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// FITUR 2 — Update Usulan
// POST /usulan/:id/update
// ─────────────────────────────────────────────────────────────────────────────
const update = async (req, res, next) => {
  const { id } = req.params;
  const userId  = req.session.userId;

  const title  = req.body.title;
  const action = req.body.action;

  const item_names      = req.body["item_names[]"];
  const item_specs      = req.body["item_specs[]"];
  const item_quantities = req.body["item_quantities[]"];
  const item_prices     = req.body["item_prices[]"];

  const errors = [];
  if (!title || title.trim() === "") errors.push("Judul usulan wajib diisi.");

  const names      = Array.isArray(item_names)      ? item_names      : item_names      ? [item_names]      : [];
  const specs      = Array.isArray(item_specs)      ? item_specs      : item_specs      ? [item_specs]      : [];
  const quantities = Array.isArray(item_quantities) ? item_quantities : item_quantities ? [item_quantities] : [];
  const prices     = Array.isArray(item_prices)     ? item_prices     : item_prices     ? [item_prices]     : [];

  if (names.filter((n) => n && n.trim() !== "").length === 0) {
    errors.push("Minimal 1 item barang harus ditambahkan.");
  }

  if (errors.length > 0) {
    const [items]    = await db.query(`SELECT * FROM equipment_proc_items WHERE equipment_proc_id = ?`, [id]);
    const [procRows] = await db.query(`SELECT * FROM equipment_procurements WHERE id = ?`, [id]);
    return res.render("usulan/edit", {
      title: "Edit Usulan Pengadaan",
      user: req.session.username || null,
      procurement: procRows[0] || {},
      items,
      errors,
    });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const employeeId = await getEmployeeId(userId);

    const [procRows] = await connection.query(
      `SELECT * FROM equipment_procurements WHERE id = ? AND created_by = ?`,
      [id, employeeId]
    );

    if (procRows.length === 0) {
      await connection.rollback();
      req.session.errorMessage = "Usulan tidak ditemukan.";
      return res.redirect("/usulan");
    }

    if (procRows[0].status !== "draft") {
      await connection.rollback();
      req.session.errorMessage = "Hanya usulan berstatus 'draft' yang dapat diedit.";
      return res.redirect("/usulan");
    }

    const newStatus = action === "submit" ? "submitted" : "draft";

    await connection.query(
      `UPDATE equipment_procurements SET title = ?, status = ?, updated_at = NOW() WHERE id = ?`,
      [title.trim(), newStatus, id]
    );

    await connection.query(
      `DELETE FROM equipment_proc_items WHERE equipment_proc_id = ?`,
      [id]
    );

    for (let i = 0; i < names.length; i++) {
      if (!names[i] || names[i].trim() === "") continue;
      const qty   = parseInt(quantities[i], 10) || 1;
      const price = parseFloat(prices[i])       || 0;
      await connection.query(
        `INSERT INTO equipment_proc_items
           (equipment_proc_id, name, specification, quantity, estimated_price,
            asset_equipment_procurement_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [id, names[i].trim(), specs[i] || null, qty, price, id]
      );
    }

    await connection.commit();

    const statusText = newStatus === "submitted" ? "diajukan ke Pengelola Aset" : "disimpan sebagai draft";
    req.session.successMessage = `Usulan berhasil diperbarui dan ${statusText}.`;
    res.redirect("/usulan");
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// FITUR 4 — Hapus Usulan (hanya status draft)
// POST /usulan/:id/delete
// ─────────────────────────────────────────────────────────────────────────────
const destroy = async (req, res, next) => {
  const { id } = req.params;
  const userId  = req.session.userId;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const employeeId = await getEmployeeId(userId);

    const [procRows] = await connection.query(
      `SELECT * FROM equipment_procurements WHERE id = ? AND created_by = ?`,
      [id, employeeId]
    );

    if (procRows.length === 0) {
      await connection.rollback();
      req.session.errorMessage = "Usulan tidak ditemukan.";
      return res.redirect("/usulan");
    }

    if (procRows[0].status !== "draft") {
      await connection.rollback();
      req.session.errorMessage = "Hanya usulan berstatus 'draft' yang dapat dihapus.";
      return res.redirect("/usulan");
    }

    await connection.query(`DELETE FROM equipment_proc_items WHERE equipment_proc_id = ?`, [id]);
    await connection.query(`DELETE FROM equipment_procurements WHERE id = ?`, [id]);

    await connection.commit();
    req.session.successMessage = "Usulan berhasil dihapus.";
    res.redirect("/usulan");
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PDF HELPERS
// ─────────────────────────────────────────────────────────────────────────────

// Warna tema
const COLORS = {
  primary:     "#1e3a5f",
  primaryMid:  "#2563eb",
  headerBg:    "#1e3a5f",
  headerText:  "#ffffff",
  subText:     "#bfdbfe",
  labelText:   "#6b7280",
  bodyText:    "#111827",
  rowAlt:      "#f8fafc",
  rowNormal:   "#ffffff",
  tableHeader: "#dbeafe",
  tableHeaderText: "#1e3a5f",
  totalRowBg:  "#1e3a5f",
  totalRowText:"#ffffff",
  borderColor: "#e2e8f0",
  sectionBg:   "#f1f5f9",
  divider:     "#cbd5e1",
  statusDraft:     "#64748b",
  statusSubmitted: "#2563eb",
  statusApproved:  "#16a34a",
  statusRejected:  "#dc2626",
  statusCompleted: "#7c3aed",
};

// Layout konstanta
const MARGIN      = 45;
const PAGE_W      = 595;   // A4 width pt
const PAGE_H      = 842;   // A4 height pt
const CONTENT_W   = PAGE_W - MARGIN * 2;  // 505
const FOOTER_Y    = PAGE_H - 70;

// Lebar kolom tabel item: Nama | Spesifikasi | Qty | Harga Satuan | Subtotal
const COL_WIDTHS = [150, 145, 35, 95, 80];
const TABLE_W    = COL_WIDTHS.reduce((a, b) => a + b, 0); // = 505

function getColX() {
  const xs = [];
  let x = MARGIN;
  COL_WIDTHS.forEach((w) => { xs.push(x); x += w; });
  return xs;
}

// Warna badge status
function statusColor(status) {
  return {
    draft:     COLORS.statusDraft,
    submitted: COLORS.statusSubmitted,
    approved:  COLORS.statusApproved,
    rejected:  COLORS.statusRejected,
    completed: COLORS.statusCompleted,
  }[status] || COLORS.statusDraft;
}

// Gambar satu baris tabel — kembalikan tinggi baris
function drawTableRow(doc, y, cells, isHeader = false, bgColor = COLORS.rowNormal, textColor = null) {
  const PAD_H = 6;   // horizontal padding
  const PAD_V = 5;   // vertical padding
  const COL_X = getColX();

  // Hitung tinggi baris berdasarkan isi sel terpanjang
  doc.fontSize(isHeader ? 8 : 8);
  let maxHeight = 0;
  cells.forEach((text, i) => {
    const h = doc.heightOfString(String(text || ""), {
      width: COL_WIDTHS[i] - PAD_H * 2,
      lineBreak: true,
    });
    if (h > maxHeight) maxHeight = h;
  });
  const rowH = Math.max(isHeader ? 22 : 20, maxHeight + PAD_V * 2);

  // Background baris
  doc.rect(MARGIN, y, TABLE_W, rowH).fillColor(bgColor).fill();

  // Border bawah baris
  doc.moveTo(MARGIN, y + rowH)
     .lineTo(MARGIN + TABLE_W, y + rowH)
     .strokeColor(COLORS.borderColor)
     .lineWidth(0.5)
     .stroke();

  // Border luar kiri & kanan
  doc.moveTo(MARGIN, y).lineTo(MARGIN, y + rowH).strokeColor(COLORS.borderColor).lineWidth(0.5).stroke();
  doc.moveTo(MARGIN + TABLE_W, y).lineTo(MARGIN + TABLE_W, y + rowH).strokeColor(COLORS.borderColor).lineWidth(0.5).stroke();

  // Garis pemisah kolom vertikal
  let lineX = MARGIN;
  for (let i = 0; i < COL_WIDTHS.length - 1; i++) {
    lineX += COL_WIDTHS[i];
    doc.moveTo(lineX, y).lineTo(lineX, y + rowH).strokeColor(COLORS.borderColor).lineWidth(0.5).stroke();
  }

  // Teks tiap sel
  const fColor = textColor || (isHeader ? COLORS.tableHeaderText : COLORS.bodyText);
  doc.fillColor(fColor)
     .font(isHeader ? "Helvetica-Bold" : "Helvetica")
     .fontSize(isHeader ? 8 : 8);

  cells.forEach((text, i) => {
    // Kolom Qty, Harga Satuan, Subtotal → rata kanan (indeks 2, 3, 4)
    const align = i >= 2 ? "right" : "left";
    doc.text(
      String(text ?? "-"),
      COL_X[i] + PAD_H,
      y + PAD_V,
      {
        width: COL_WIDTHS[i] - PAD_H * 2,
        height: rowH - PAD_V * 2,
        align,
        lineBreak: true,
      }
    );
  });

  return rowH;
}

// Gambar header tabel (dengan border atas)
function drawTableHeader(doc, y) {
  const COL_X = getColX();
  const PAD_H = 6;
  const rowH  = 22;

  // Latar header
  doc.rect(MARGIN, y, TABLE_W, rowH).fillColor(COLORS.tableHeader).fill();

  // Border atas
  doc.moveTo(MARGIN, y).lineTo(MARGIN + TABLE_W, y).strokeColor(COLORS.primaryMid).lineWidth(1).stroke();

  // Border bawah
  doc.moveTo(MARGIN, y + rowH).lineTo(MARGIN + TABLE_W, y + rowH).strokeColor(COLORS.borderColor).lineWidth(0.5).stroke();

  // Border kiri & kanan
  doc.moveTo(MARGIN, y).lineTo(MARGIN, y + rowH).strokeColor(COLORS.borderColor).lineWidth(0.5).stroke();
  doc.moveTo(MARGIN + TABLE_W, y).lineTo(MARGIN + TABLE_W, y + rowH).strokeColor(COLORS.borderColor).lineWidth(0.5).stroke();

  // Garis pemisah kolom
  let lineX = MARGIN;
  for (let i = 0; i < COL_WIDTHS.length - 1; i++) {
    lineX += COL_WIDTHS[i];
    doc.moveTo(lineX, y).lineTo(lineX, y + rowH).strokeColor(COLORS.borderColor).lineWidth(0.5).stroke();
  }

  // Teks header
  const headers = ["Nama Barang", "Spesifikasi", "Qty", "Harga Satuan", "Subtotal"];
  doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.tableHeaderText);
  headers.forEach((h, i) => {
    const align = i >= 2 ? "right" : "left";
    doc.text(h, COL_X[i] + PAD_H, y + 7, {
      width: COL_WIDTHS[i] - PAD_H * 2,
      align,
    });
  });

  return rowH;
}

// Gambar baris TOTAL di akhir tabel
function drawTotalRow(doc, y, totalText) {
  const COL_X  = getColX();
  const PAD_H  = 6;
  const rowH   = 22;
  const totalColW = COL_WIDTHS.slice(2).reduce((a, b) => a + b, 0); // Qty + Harga + Subtotal
  const labelW    = COL_WIDTHS[0] + COL_WIDTHS[1];

  // Latar baris total
  doc.rect(MARGIN, y, TABLE_W, rowH).fillColor(COLORS.primary).fill();

  // Border
  doc.rect(MARGIN, y, TABLE_W, rowH).strokeColor(COLORS.primary).lineWidth(0.5).stroke();

  // Label "TOTAL ESTIMASI"
  doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.headerText)
     .text("TOTAL ESTIMASI", MARGIN + PAD_H, y + 7, { width: labelW - PAD_H * 2 });

  // Nilai total (rata kanan di kolom subtotal)
  doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.headerText)
     .text(totalText, COL_X[2], y + 7, {
       width: totalColW - PAD_H,
       align: "right",
     });

  return rowH;
}

// Cetak footer di halaman tertentu
function drawFooter(doc, pageNum, totalPages, tanggal) {
  // Garis footer
  doc.moveTo(MARGIN, FOOTER_Y - 8)
     .lineTo(MARGIN + CONTENT_W, FOOTER_Y - 8)
     .strokeColor(COLORS.divider)
     .lineWidth(0.5)
     .stroke();

  doc.font("Helvetica").fontSize(7.5).fillColor(COLORS.labelText);

  doc.text(
    `Dokumen ini digenerate otomatis oleh FacultyWare — ${tanggal}`,
    MARGIN,
    FOOTER_Y,
    { width: CONTENT_W * 0.65, lineBreak: false}
  );

  doc.text(
    `Halaman ${pageNum} dari ${totalPages}`,
    MARGIN,
    FOOTER_Y,
    { width: CONTENT_W, align: "right", lineBreak: false }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FITUR 5 — Download Laporan PDF Rekapan
// GET /usulan/laporan/pdf
// ─────────────────────────────────────────────────────────────────────────────
const downloadLaporan = async (req, res, next) => {
  try {
    const userId     = req.session.userId;
    const employeeId = await getEmployeeId(userId);

    const [procurements] = await db.query(
      `SELECT ep.*, e.name AS employee_name, e.employee_number
       FROM equipment_procurements ep
       LEFT JOIN employees e ON ep.created_by = e.id
       WHERE ep.created_by = ?
       ORDER BY ep.created_at DESC`,
      [employeeId]
    );

    for (const proc of procurements) {
      const [items] = await db.query(
        `SELECT * FROM equipment_proc_items WHERE equipment_proc_id = ? ORDER BY id`,
        [proc.id]
      );
      proc.items = items;
      proc.total_estimasi = items.reduce(
        (sum, item) => sum + parseFloat(item.estimated_price || 0) * (item.quantity || 1),
        0
      );
    }

    // ── Setup dokumen ─────────────────────────────────────────────────────────
    const doc = new PDFDocument({ margin: MARGIN, size: "A4", bufferPages: true });

    const tanggal  = new Date().toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" });
    const namaUser = req.session.username || "Ketua Departemen";

    res.setHeader( "Content-Disposition",
      'attachment; filename="Laporan Rekapan Pengadaan Barang.pdf"'
    );
    doc.pipe(res);

    // ── HALAMAN 1: HEADER UTAMA ───────────────────────────────────────────────
    let curY = MARGIN;

    // Kotak header biru gelap
    const HEADER_H = 75;
    doc.rect(MARGIN, curY, CONTENT_W, HEADER_H).fillColor(COLORS.headerBg).fill();

    // Judul laporan
    doc.font("Helvetica-Bold").fontSize(16).fillColor(COLORS.headerText)
       .text(
         "LAPORAN REKAPAN PENGADAAN BARANG",
         MARGIN, curY + 14,
         { width: CONTENT_W, align: "center" }
       );

    // Sub-judul
    doc.font("Helvetica").fontSize(9).fillColor(COLORS.subText)
       .text(
         "FacultyWare \u2014 Sistem Informasi Aset Fakultas",
         MARGIN, curY + 36,
         { width: CONTENT_W, align: "center" }
       );

    // Strip aksen bawah header
    doc.rect(MARGIN, curY + HEADER_H - 4, CONTENT_W, 4).fillColor(COLORS.primaryMid).fill();

    curY += HEADER_H + 12;

    // ── Info ringkasan ─────────────────────────────────────────────────────────
    // Kotak abu-abu info
    const INFO_H = 42;
    doc.rect(MARGIN, curY, CONTENT_W, INFO_H).fillColor(COLORS.sectionBg).fill();
    doc.rect(MARGIN, curY, 3, INFO_H).fillColor(COLORS.primaryMid).fill();

    const halfW = CONTENT_W / 2 - 10;
    const infoX1 = MARGIN + 10;
    const infoX2 = MARGIN + CONTENT_W / 2 + 5;

    // Kolom kiri
    doc.font("Helvetica-Bold").fontSize(7).fillColor(COLORS.labelText)
       .text("DICETAK OLEH", infoX1, curY + 8, { width: halfW });
    doc.font("Helvetica").fontSize(9).fillColor(COLORS.bodyText)
       .text(namaUser, infoX1, curY + 18, { width: halfW });

    // Kolom kanan kiri: tanggal
    doc.font("Helvetica-Bold").fontSize(7).fillColor(COLORS.labelText)
       .text("TANGGAL CETAK", infoX2, curY + 8, { width: halfW / 2 });
    doc.font("Helvetica").fontSize(9).fillColor(COLORS.bodyText)
       .text(tanggal, infoX2, curY + 18, { width: halfW / 2 });

    // Kolom kanan kanan: total usulan
    const infoX3 = infoX2 + halfW / 2 + 10;
    doc.font("Helvetica-Bold").fontSize(7).fillColor(COLORS.labelText)
       .text("TOTAL USULAN", infoX3, curY + 8, { width: halfW / 2 });
    doc.font("Helvetica").fontSize(9).fillColor(COLORS.bodyText)
       .text(`${procurements.length} usulan`, infoX3, curY + 18, { width: halfW / 2 });

    curY += INFO_H + 18;

    // ── KONTEN TIAP USULAN ────────────────────────────────────────────────────
    if (procurements.length === 0) {
      doc.font("Helvetica").fontSize(11).fillColor(COLORS.labelText)
         .text("Belum ada usulan pengadaan barang.", MARGIN, curY, { width: CONTENT_W, align: "center" });
    }

    procurements.forEach((proc, procIdx) => {
      // Estimasi tinggi blok: badge (20) + info (54) + gap (8) + headerTabel (22) + baris*20 + total (22) + spacing (18)
      const estimatedH = 20 + 54 + 8 + 22 + Math.max(proc.items.length, 1) * 22 + 22 + 18;

      if (
        procIdx > 0 &&
        curY + estimatedH > FOOTER_Y - 20
      ) {
        doc.addPage();
        curY = MARGIN;
      }

      // Reset posisi internal PDFKit agar setiap request dimulai dari margin kiri (full width)
      doc.x = MARGIN;
      doc.y = curY;

      // ── Badge nomor & status ─────────────────────────────────────────────────
      const BADGE_H = 22;

      // Latar badge abu-abu terang
      doc.rect(MARGIN, curY, CONTENT_W, BADGE_H).fillColor(COLORS.sectionBg).fill();

      // Aksen warna kiri sesuai status
      const sColor = statusColor(proc.status);
      doc.rect(MARGIN, curY, 3, BADGE_H).fillColor(sColor).fill();

      // Nomor urut + request number
      doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.primary)
         .text(
           `#${procIdx + 1}  ${proc.request_number}`,
           MARGIN + 10, curY + 6,
           { width: CONTENT_W * 0.6 }
         );

      // Badge status (teks di kanan)
      doc.font("Helvetica-Bold")
      .fontSize(8)
      .fillColor(sColor)
      .text(
        `Status : ${statusLabel(proc.status)}`,
        MARGIN,
        curY + 7,
        {
          width: CONTENT_W - 10,
          align: "right"
        }
      );

      curY += BADGE_H;

      // ── Info detail dalam 2 kolom ──────────────────────────────────────────
      const DETAIL_H = 52;
      doc.rect(MARGIN, curY, CONTENT_W, DETAIL_H).fillColor(COLORS.rowNormal).fill();
      // Border bawah ringan
      doc.moveTo(MARGIN, curY + DETAIL_H)
         .lineTo(MARGIN + CONTENT_W, curY + DETAIL_H)
         .strokeColor(COLORS.borderColor).lineWidth(0.5).stroke();

      const colA_X = MARGIN + 10;
      const colB_X = MARGIN + CONTENT_W * 0.5 + 5;
      const colW   = CONTENT_W * 0.48;

      // Helper: gambar label-value pair
      const drawField = (label, value, x, y, width) => {
        doc.font("Helvetica-Bold").fontSize(7).fillColor(COLORS.labelText)
           .text(label, x, y, { width });
        doc.font("Helvetica").fontSize(8.5).fillColor(COLORS.bodyText)
           .text(String(value || "-"), x, y + 9, { width, lineBreak: false, ellipsis: true });
      };

      const tglDibuat = new Date(proc.created_at).toLocaleDateString("id-ID", {
        day: "2-digit", month: "long", year: "numeric",
      });

      // Baris 1
      drawField("JUDUL USULAN",   proc.title,                        colA_X, curY + 7,  colW);
      drawField("DIAJUKAN OLEH",  proc.employee_name || namaUser,    colB_X, curY + 7,  colW);

      // Baris 2
      drawField("TOTAL ESTIMASI", formatRupiah(proc.total_estimasi), colA_X, curY + 29, colW);
      drawField("TANGGAL DIBUAT", tglDibuat,                         colB_X, curY + 29, colW);

      curY += DETAIL_H + 6;

      // ── Tabel item ─────────────────────────────────────────────────────────
      curY += drawTableHeader(doc, curY);

      if (proc.items.length === 0) {
        curY += drawTableRow(doc, curY, ["(Tidak ada item)", "", "", "", ""], false, COLORS.rowAlt);
      } else {
        proc.items.forEach((item, itemIdx) => {
          // Pindah halaman jika tidak cukup ruang (perlu minimal 1 baris + total row)
          if (curY + 44 > FOOTER_Y - 20) {
            doc.addPage();
            curY = MARGIN;
            // Ulangi header tabel
            curY += drawTableHeader(doc, curY);
          }

          const subtotal = parseFloat(item.estimated_price || 0) * (item.quantity || 1);
          const bg       = itemIdx % 2 === 0 ? COLORS.rowNormal : COLORS.rowAlt;

          curY += drawTableRow(
            doc,
            curY,
            [
              item.name          || "-",
              item.specification || "-",
              String(item.quantity || 0),
              formatRupiah(item.estimated_price),
              formatRupiah(subtotal),
            ],
            false,
            bg
          );
        });
      }

      // Baris TOTAL
      curY += drawTotalRow(doc, curY, formatRupiah(proc.total_estimasi));

      // Spasi antar usulan
      if (procIdx < procurements.length - 1) {
        curY += 20;
      }
    });

    // ── FOOTER tiap halaman ───────────────────────────────────────────────────
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      drawFooter(doc, i + 1, totalPages, tanggal);
    }

    doc.end();
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// FITUR 6 — API JSON Riwayat Pengajuan
// GET /usulan/api/riwayat
// ─────────────────────────────────────────────────────────────────────────────
const apiRiwayat = async (req, res, next) => {
  try {
    const userId     = req.session.userId;
    const employeeId = await getEmployeeId(userId);

    const [procurements] = await db.query(
      `SELECT
         ep.id,
         ep.request_number,
         ep.title,
         ep.status,
         ep.created_at,
         ep.updated_at,
         e.name            AS created_by_name,
         e.employee_number
       FROM equipment_procurements ep
       LEFT JOIN employees e ON ep.created_by = e.id
       WHERE ep.created_by = ?
       ORDER BY ep.created_at DESC`,
      [employeeId]
    );

    for (const proc of procurements) {
      const [items] = await db.query(
        `SELECT id, name, specification, quantity, estimated_price
         FROM equipment_proc_items
         WHERE equipment_proc_id = ?
         ORDER BY id`,
        [proc.id]
      );
      proc.items = items;
      proc.total_estimasi = items.reduce(
        (sum, item) => sum + parseFloat(item.estimated_price || 0) * (item.quantity || 1),
        0
      );
    }

    res.json({
      status: "success",
      total_usulan: procurements.length,
      data: procurements.map(proc => ({
        nomor_permintaan: proc.request_number,
        judul_usulan: proc.title,
        status: proc.status,
        status_label: statusLabelForRequest(proc.status, proc.request_number),
        tanggal_dibuat: proc.created_at,
        total_estimasi: proc.total_estimasi,
        barang: proc.items,
      })),
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  index,
  createPage,
  store,
  editPage,
  update,
  destroy,
  downloadLaporan,
  apiRiwayat,
};
