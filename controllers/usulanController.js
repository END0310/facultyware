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
    submitted: "Diajukan",
    approved: "Disetujui",
    rejected: "Ditolak",
    completed: "Selesai",
  };
  return map[status] || status;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: ambil employee_id yang sesuai dengan user yang login
// KRITIS: equipment_procurements.created_by → REFERENCES employees.id
// Jadi userId (users.id) harus ada di tabel employees dengan id yang sama,
// ATAU kita cari employee berdasarkan nama yang cocok.
// Solusi: setup_database_lengkap.sql memastikan users.id = employees.id
// ─────────────────────────────────────────────────────────────────────────────
async function getEmployeeId(userId) {
  // Cek apakah ada employees.id = userId (setup default kita)
  const [rows] = await db.query(
    `SELECT id FROM employees WHERE id = ?`,
    [userId]
  );
  if (rows.length > 0) return rows[0].id;

  // Fallback: ambil employee pertama yang ada (untuk dev/testing)
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
       WHERE ep.created_by = ?
       GROUP BY ep.id
       ORDER BY ep.created_at DESC`,
      [userId]
    );

    const successMessage = req.session.successMessage || null;
    const errorMessage = req.session.errorMessage || null;
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

  const title = req.body.title;
  const action = req.body.action;
  
  const item_names = req.body["item_names[]"];
  const item_specs = req.body["item_specs[]"];
  const item_quantities = req.body["item_quantities[]"];
  const item_prices = req.body["item_prices[]"];

  // ── Validasi ────────────────────────────────────────────────────────────────
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

    // KRITIS: cari employee_id yang valid (harus ada di tabel employees)
    const employeeId = await getEmployeeId(userId);
    const requestNumber = await generateRequestNumber();

    // Insert header procurement
    // created_by dan employee_id keduanya → employees.id
    const [result] = await connection.query(
      `INSERT INTO equipment_procurements
         (request_number, title, status, created_by, employee_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [requestNumber, title.trim(), status, employeeId, employeeId]
    );

    const procId = result.insertId;

    // Insert items
    // asset_equipment_procurement_id NOT NULL → isi dengan procId
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

    const statusText = status === "submitted" ? "diajukan" : "disimpan sebagai draft";
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
    const userId  = req.session.userId;
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
  const userId = req.session.userId;

  const title = req.body.title;
  const action = req.body.action;

  const item_names = req.body["item_names[]"];
  const item_specs = req.body["item_specs[]"];
  const item_quantities = req.body["item_quantities[]"];
  const item_prices = req.body["item_prices[]"];

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

    const statusText = newStatus === "submitted" ? "diajukan" : "disimpan sebagai draft";
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

    await connection.query(
      `DELETE FROM equipment_proc_items WHERE equipment_proc_id = ?`,
      [id]
    );

    await connection.query(
      `DELETE FROM equipment_procurements WHERE id = ?`,
      [id]
    );

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
// FITUR 5 — Download Laporan PDF Rekapan
// GET /usulan/laporan/pdf
// ─────────────────────────────────────────────────────────────────────────────
const downloadLaporan = async (req, res, next) => {
  try {
    const userId = req.session.userId;
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

    const doc = new PDFDocument({ margin: 50, size: "A4" });

    const tanggal = new Date().toLocaleDateString("id-ID", {
      year: "numeric", month: "long", day: "numeric",
    });
    const namaUser = req.session.username || "Ketua Departemen";

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=laporan-pengadaan-${Date.now()}.pdf`
    );
    doc.pipe(res);

    // ── Header ─────────────────────────────────────────────────────────────────
    doc.fontSize(16).font("Helvetica-Bold")
       .text("LAPORAN REKAPAN PENGADAAN BARANG", { align: "center" });
    doc.fontSize(11).font("Helvetica")
       .text("FacultyWare — Sistem Informasi Aset Fakultas", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(10).text(`Dicetak oleh : ${namaUser}`, { align: "center" });
    doc.fontSize(10).text(`Tanggal Cetak: ${tanggal}`, { align: "center" });
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).lineWidth(1).stroke();
    doc.moveDown(0.8);

    if (procurements.length === 0) {
      doc.fontSize(11).text("Belum ada usulan pengadaan barang.", { align: "center" });
    }

    // ── Isi tiap usulan ────────────────────────────────────────────────────────
    for (const proc of procurements) {
      if (doc.y > 650) doc.addPage();

      doc.moveDown(0.4);
      doc.fontSize(11).font("Helvetica-Bold").text(`No. Request : ${proc.request_number}`);
      doc.font("Helvetica").fontSize(10);
      doc.text(`Judul       : ${proc.title}`);
      doc.text(`Status      : ${statusLabel(proc.status)}`);
      doc.text(
        `Dibuat      : ${new Date(proc.created_at).toLocaleDateString("id-ID", {
          year: "numeric", month: "long", day: "numeric",
        })}`
      );
      doc.text(`Total Est.  : ${formatRupiah(proc.total_estimasi)}`);
      doc.moveDown(0.4);

      if (proc.items.length > 0) {
        const colX = [52, 210, 330, 400, 475];
        const rowH = 20;
        let y = doc.y;

        // Header tabel
        doc.rect(50, y, 495, rowH).fill("#e5e7eb").stroke();
        doc.fillColor("#000000").fontSize(9).font("Helvetica-Bold");
        doc.text("Nama Barang",  colX[0]+2, y+6, { width:154, lineBreak:false });
        doc.text("Spesifikasi",  colX[1]+2, y+6, { width:116, lineBreak:false });
        doc.text("Qty",          colX[2]+2, y+6, { width:65, align:"center", lineBreak:false });
        doc.text("Harga Satuan", colX[3]+2, y+6, { width:72, lineBreak:false });
        doc.text("Subtotal",     colX[4]+2, y+6, { width:68, lineBreak:false });
        y += rowH;

        doc.font("Helvetica").fontSize(8.5);
        for (const item of proc.items) {
          if (y > 710) { doc.addPage(); y = 50; }

          const subtotal = parseFloat(item.estimated_price || 0) * (item.quantity || 1);

          doc.rect(50, y, 495, rowH).fillColor("#ffffff").fill().stroke();
          doc.fillColor("#111111");
          doc.text(item.name || "-",                    colX[0]+2, y+6, { width:154, lineBreak:false });
          doc.text(item.specification || "-",            colX[1]+2, y+6, { width:116, lineBreak:false });
          doc.text(String(item.quantity || 0),           colX[2]+2, y+6, { width:65, align:"center", lineBreak:false });
          doc.text(formatRupiah(item.estimated_price),   colX[3]+2, y+6, { width:72, lineBreak:false });
          doc.text(formatRupiah(subtotal),               colX[4]+2, y+6, { width:68, lineBreak:false });
          y += rowH;
        }

        // Baris total
        doc.rect(50, y, 495, rowH).fill("#f3f4f6").stroke();
        doc.fillColor("#000000").font("Helvetica-Bold").fontSize(9);
        doc.text("TOTAL ESTIMASI", colX[0]+2, y+6, { width:415, lineBreak:false });
        doc.text(formatRupiah(proc.total_estimasi), colX[4]+2, y+6, { width:68, lineBreak:false });
        doc.y = y + rowH + 8;
      } else {
        doc.fontSize(9).text("   (Tidak ada item barang)");
      }

      doc.moveTo(50, doc.y+4).lineTo(545, doc.y+4).strokeColor("#cccccc").lineWidth(0.5).stroke();
      doc.strokeColor("#000000").lineWidth(1);
    }

    // ── Footer ─────────────────────────────────────────────────────────────────
    doc.moveDown(2);
    doc.fontSize(8).fillColor("#888888")
       .text(`Dokumen digenerate otomatis oleh FacultyWare — ${tanggal}`, { align: "center" });

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
    const userId = req.session.userId;
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
      message: "Data riwayat pengajuan pengadaan barang berhasil diambil",
      data: {
        user_id: userId,
        employee_id: employeeId,
        total_usulan: procurements.length,
        procurements,
      },
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