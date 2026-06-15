const db = require('../../lib/db');
const { applyProcurementDecision } = require('../../lib/procurement-assets');

const requestStatuses = ['submitted', 'rejected'];
const procurementStatuses = ['draft', 'submitted', 'approved', 'rejected', 'completed'];
const reportTypes = ['requests', 'procurements', 'assets'];
const assetStatuses = ['available', 'in_use', 'maintenance', 'disposed'];

function flash(req, type, message) {
  req.session.flash = { type, message };
}

function currentEmployeeId(req) {
  return req.session.employeeId || req.session.userId;
}

function redirectBack(req, res, fallback) {
  return res.redirect(req.get('Referrer') || fallback);
}

function nowRequestNumber(prefix) {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${prefix}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-${Math.floor(Math.random() * 900 + 100)}`;
}

function rupiah(value) {
  const n = Number(value || 0);
  return n.toLocaleString('id-ID');
}

function isValidDateInput(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function isFiniteNonNegativeNumber(value) {
  return Number.isFinite(value) && value >= 0;
}

function normalizeReportFilters(query = {}) {
  const reportType = reportTypes.includes(query.report_type) ? query.report_type : 'procurements';
  const statuses = reportType === 'requests'
    ? requestStatuses
    : reportType === 'assets'
      ? assetStatuses
      : procurementStatuses;

  const filters = {
    report_type: reportType,
    status: statuses.includes(query.status) ? query.status : '',
    start_date: isValidDateInput(query.start_date) ? query.start_date : '',
    end_date: isValidDateInput(query.end_date) ? query.end_date : ''
  };

  if (filters.start_date && filters.end_date && filters.start_date > filters.end_date) {
    const startDate = filters.start_date;
    filters.start_date = filters.end_date;
    filters.end_date = startDate;
  }

  return { reportType, filters, statuses };
}

async function getProcurement(id) {
  const [rows] = await db.query(`
    SELECT ep.*, creator.name AS created_by_name, creator_user.email AS created_by_email,
           (
             SELECT COUNT(*)
             FROM assets a
             WHERE a.acquisition_type = 'procurement' AND a.asset_grant_id = ep.id
           ) AS asset_count
    FROM equipment_procurements ep
    LEFT JOIN employees creator ON creator.id = ep.created_by
    LEFT JOIN users creator_user ON creator_user.id = creator.id
    WHERE ep.id = ?
    LIMIT 1
  `, [id]);
  return rows[0];
}

async function getProcurementItems(id) {
  const [items] = await db.query(`
    SELECT *
    FROM equipment_proc_items
    WHERE equipment_proc_id = ?
    ORDER BY id ASC
  `, [id]);
  return items;
}

const listRequests = async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim();
    const page   = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit  = 10;
    const offset = (page - 1) * limit;

    let whereClause = `WHERE ep.request_number LIKE 'REQ-%' AND ep.status IN ('submitted', 'rejected')`;
    const params = [];

    if (search) {
      whereClause += ' AND (ep.request_number LIKE ? OR ep.title LIKE ? OR item.name LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    const [countRows] = await db.query(
      `SELECT COUNT(DISTINCT ep.id) AS total
       FROM equipment_procurements ep
       LEFT JOIN equipment_proc_items item ON item.equipment_proc_id = ep.id
       ${whereClause}`,
      params
    );
    const totalItems = countRows[0].total;
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    const [requests] = await db.query(`
      SELECT
        ep.id,
        ep.request_number,
        ep.title,
        ep.status,
        ep.created_at,
        ep.updated_at,
        emp.name AS employee_name,
        COUNT(item.id) AS item_count,
        COALESCE(SUM(item.quantity), 0) AS total_quantity,
        COALESCE(SUM(item.quantity * item.estimated_price), 0) AS total_estimated_price
      FROM equipment_procurements ep
      LEFT JOIN employees emp ON emp.id = ep.created_by
      LEFT JOIN equipment_proc_items item ON item.equipment_proc_id = ep.id
      ${whereClause}
      GROUP BY ep.id, emp.name
      ORDER BY ep.created_at DESC, ep.id DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);
    res.render('pengelola-aset/procurements/requests/index', { title: 'Daftar Usulan Pengadaan', requests, rupiah, search, currentPage: page, totalPages, totalItems });
  } catch (err) {
    next(err);
  }
};

const detailRequest = async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT ep.*, emp.name AS employee_name
      FROM equipment_procurements ep
      LEFT JOIN employees emp ON emp.id = ep.created_by
      WHERE ep.id = ?
      LIMIT 1
    `, [req.params.id]);
    if (!rows.length) return res.status(404).render('error', { message: 'Usulan tidak ditemukan', error: { status: 404, stack: '' } });
    const items = await getProcurementItems(req.params.id);
    res.render('pengelola-aset/procurements/requests/detail', { title: 'Detail Usulan', request: rows[0], items, requestStatuses, rupiah });
  } catch (err) {
    next(err);
  }
};

const updateRequestStatus = async (req, res, next) => {
  const { status } = req.body;
  if (!requestStatuses.includes(status)) {
    flash(req, 'error', 'Status usulan tidak valid.');
    return redirectBack(req, res, '/procurements/requests');
  }

  try {
    const [result] = await db.query(`
      UPDATE equipment_procurements
      SET request_number = CASE WHEN ? = 'submitted' THEN ? ELSE request_number END,
          status = ?,
          updated_at = NOW()
      WHERE id = ? AND status = 'submitted' AND request_number LIKE 'REQ-%'
    `, [status, nowRequestNumber('PR'), status, req.params.id]);
    if (!result.affectedRows) {
      flash(req, 'error', 'Usulan hanya bisa diproses saat masih menunggu Pengelola Aset.');
      return res.redirect(`/procurements/requests/${req.params.id}`);
    }
    flash(req, 'success', status === 'submitted' ? 'Usulan berhasil diteruskan ke Wakil Dekan.' : 'Usulan berhasil ditolak.');
    res.redirect(`/procurements/requests/${req.params.id}`);
  } catch (err) {
    next(err);
  }
};

const showCreateProcurement = async (req, res, next) => {
  try {
    let sourceRequest = null;
    if (req.query.request_id) {
      const [rows] = await db.query(`
        SELECT
          ep.id,
          ep.request_number,
          ep.title,
          item.name,
          item.specification,
          item.quantity,
          item.estimated_price
        FROM equipment_procurements ep
        LEFT JOIN equipment_proc_items item ON item.equipment_proc_id = ep.id
        WHERE ep.id = ?
        ORDER BY item.id ASC
        LIMIT 1
      `, [req.query.request_id]);
      sourceRequest = rows[0] || null;
    }
    res.render('pengelola-aset/procurements/create', { title: 'Buat Permohonan Pengadaan', sourceRequest });
  } catch (err) {
    next(err);
  }
};

const createProcurement = async (req, res, next) => {
  const title = String(req.body.title || '').trim();
  const itemName = String(req.body.name || '').trim();
  const specification = String(req.body.specification || '').trim() || null;
  const quantity = Number(req.body.quantity || 0);
  const estimatedPrice = Number(req.body.estimated_price || 0);

  if (!title || !itemName || !Number.isInteger(quantity) || quantity <= 0 || estimatedPrice < 0) {
    flash(req, 'error', 'Validasi gagal: judul, nama barang, jumlah > 0, dan estimasi harga wajib benar.');
    return redirectBack(req, res, '/procurements/create');
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const requestNumber = nowRequestNumber('PR');
    const employeeId = currentEmployeeId(req);

    const [procResult] = await conn.query(`
      INSERT INTO equipment_procurements
      (request_number, title, status, created_by, employee_id, created_at, updated_at)
      VALUES (?, ?, 'draft', ?, ?, NOW(), NOW())
    `, [requestNumber, title, employeeId, employeeId]);

    const procurementId = procResult.insertId;
    await conn.query(`
      INSERT INTO equipment_proc_items
      (equipment_proc_id, name, specification, quantity, estimated_price, asset_equipment_procurement_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [procurementId, itemName, specification, quantity, estimatedPrice, procurementId]);

    await conn.commit();
    flash(req, 'success', 'Permohonan pengadaan berhasil dibuat.');
    res.redirect(`/procurements/${procurementId}`);
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

const listProcurements = async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim();
    const page   = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit  = 10;
    const offset = (page - 1) * limit;

    let whereClause = `WHERE ep.request_number NOT LIKE 'REQ-%'`;
    const params = [];

    if (search) {
      whereClause += ' AND (ep.request_number LIKE ? OR ep.title LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like);
    }

    const [countRows] = await db.query(
      `SELECT COUNT(*) AS total FROM equipment_procurements ep ${whereClause}`,
      params
    );
    const totalItems = countRows[0].total;
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    const [procurements] = await db.query(`
      SELECT ep.*, emp.name AS created_by_name, COUNT(item.id) AS item_count, COALESCE(SUM(item.quantity * item.estimated_price), 0) AS total_estimated_price
      FROM equipment_procurements ep
      LEFT JOIN employees emp ON emp.id = ep.created_by
      LEFT JOIN equipment_proc_items item ON item.equipment_proc_id = ep.id
      ${whereClause}
      GROUP BY ep.id, emp.name
      ORDER BY ep.created_at DESC, ep.id DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);
    res.render('pengelola-aset/procurements/index', { title: 'Daftar Permohonan Pengadaan', procurements, rupiah, search, currentPage: page, totalPages, totalItems });
  } catch (err) {
    next(err);
  }
};

const procurementItemsPage = async (req, res, next) => {
  try {
    res.render('pengelola-aset/procurements/items', { title: 'Data Barang Pengadaan' });
  } catch (err) {
    next(err);
  }
};

const detailProcurement = async (req, res, next) => {
  try {
    const procurement = await getProcurement(req.params.id);
    if (!procurement) return res.status(404).render('error', { message: 'Permohonan tidak ditemukan', error: { status: 404, stack: '' } });
    const items = await getProcurementItems(req.params.id);
    res.render('pengelola-aset/procurements/detail', { title: 'Detail Permohonan', procurement, items, rupiah });
  } catch (err) {
    next(err);
  }
};

const submitProcurement = async (req, res, next) => {
  try {
    const [result] = await db.query(`
      UPDATE equipment_procurements
      SET status = 'submitted', updated_at = NOW()
      WHERE id = ? AND status = 'draft'
    `, [req.params.id]);
    flash(req, result.affectedRows ? 'success' : 'error', result.affectedRows ? 'Permohonan berhasil disubmit ke Wakil Dekan.' : 'Permohonan hanya bisa disubmit saat status draft.');
    res.redirect(`/procurements/${req.params.id}`);
  } catch (err) {
    next(err);
  }
};

const decideProcurement = async (req, res, next) => {
  const decision = String(req.body.decision || '').trim();
  if (!['approved', 'rejected'].includes(decision)) {
    flash(req, 'error', 'Keputusan tidak valid.');
    return redirectBack(req, res, `/procurements/${req.params.id}`);
  }
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const result = await applyProcurementDecision(conn, req.params.id, decision);
    if (!result.updated) {
      await conn.rollback();
      flash(req, 'error', 'Permohonan hanya bisa diputuskan saat status submitted.');
      return res.redirect(`/procurements/${req.params.id}`);
    }
    await conn.commit();
    flash(
      req,
      'success',
      decision === 'approved'
        ? 'Permohonan berhasil di-approve. Pengelola Aset dapat mencatat barang ke daftar aset.'
        : 'Permohonan berhasil di-reject.'
    );
    res.redirect(`/procurements/${req.params.id}`);
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

const showAddAsset = async (req, res, next) => {
  try {
    const procurement = await getProcurement(req.params.id);
    if (!procurement) return res.status(404).render('error', { message: 'Permohonan tidak ditemukan', error: { status: 404, stack: '' } });
    if (procurement.status !== 'approved') {
      flash(req, 'error', 'Barang hanya bisa ditambahkan jika permohonan sudah approved.');
      return res.redirect(`/procurements/${req.params.id}`);
    }
    const items = await getProcurementItems(req.params.id);
    const selectedItemId = Number(req.query.item_id || items[0]?.id || 0);
    const selectedItem = items.find((item) => Number(item.id) === selectedItemId) || items[0] || null;

    res.render('pengelola-aset/procurements/add-asset', {
      title: 'Tambah Barang Hasil Pengadaan',
      procurement,
      items,
      selectedItemId: selectedItem ? Number(selectedItem.id) : null,
      initialValues: {
        item_id: selectedItem ? Number(selectedItem.id) : '',
        code: '',
        name: selectedItem?.name || '',
        brand: '',
        model: '',
        serial_number: '',
        acquisition_date: '',
        acquisition_cost: selectedItem?.estimated_price || 0,
        specification: selectedItem?.specification || ''
      }
    });
  } catch (err) {
    next(err);
  }
};

const addAssetFromProcurement = async (req, res, next) => {
  const selectedItemId = Number(req.body.item_id || 0);
  const assetCode = String(req.body.code || '').trim();
  const name = String(req.body.name || '').trim();
  const acquisitionDate = String(req.body.acquisition_date || '').trim();
  const acquisitionCost = Number(req.body.acquisition_cost || 0);
  const brand = String(req.body.brand || '').trim() || null;
  const model = String(req.body.model || '').trim() || null;
  const serialNumber = String(req.body.serial_number || '').trim() || null;
  const specification = String(req.body.specification || '').trim() || null;

  const formValues = {
    item_id: selectedItemId || '',
    code: assetCode,
    name,
    brand: brand || '',
    model: model || '',
    serial_number: serialNumber || '',
    acquisition_date: acquisitionDate,
    acquisition_cost: Number.isFinite(acquisitionCost) ? acquisitionCost : '',
    specification: specification || ''
  };

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [procRows] = await conn.query('SELECT * FROM equipment_procurements WHERE id = ? FOR UPDATE', [req.params.id]);
    const procurement = procRows[0];
    if (!procurement || procurement.status !== 'approved') throw new Error('Permohonan belum approved atau tidak ditemukan.');
    const items = await getProcurementItems(req.params.id);
    const selectedItem = items.find((item) => Number(item.id) === selectedItemId) || items[0] || null;

    if (!selectedItem) {
      await conn.rollback();
      flash(req, 'error', 'Item pengadaan tidak ditemukan.');
      return res.redirect(`/procurements/${req.params.id}`);
    }

    if (!assetCode || !name || !isValidDateInput(acquisitionDate) || !isFiniteNonNegativeNumber(acquisitionCost)) {
      await conn.rollback();
      return res.status(422).render('pengelola-aset/procurements/add-asset', {
        title: 'Tambah Barang Hasil Pengadaan',
        procurement,
        items,
        selectedItemId: Number(selectedItem.id),
        initialValues: formValues,
        flash: {
          type: 'error',
          message: 'Validasi gagal: pilih item, isi kode aset, nama barang, tanggal perolehan valid, dan harga tidak boleh negatif.'
        }
      });
    }

    const [assetResult] = await conn.query(`
      INSERT INTO assets
      (name, code, type, acquisition_type, acquisition_date, acquisition_cost, asset_grant_id, \`condition\`, status, created_at, updated_at)
      VALUES (?, ?, 'equipment', 'procurement', ?, ?, NULL, 'good', 'available', NOW(), NOW())
    `, [name, assetCode, acquisitionDate, acquisitionCost]);

    await conn.query(`
      INSERT INTO equipments
      (asset_id, brand, model, serial_number, specification, purchase_link, photo, depreciation_value, useful_life, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NOW(), NOW())
    `, [assetResult.insertId, brand, model, serialNumber, specification]);

    await conn.query(`
      UPDATE equipment_procurements
      SET status = 'completed', updated_at = NOW()
      WHERE id = ?
    `, [req.params.id]);

    await conn.commit();
    flash(
      req,
      'success',
      'Barang berhasil ditambahkan ke sistem aset.'
    );
    res.redirect(`/procurements/${req.params.id}`);
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      const procurement = await getProcurement(req.params.id);
      const items = await getProcurementItems(req.params.id);
      const selectedItem = items.find((item) => Number(item.id) === selectedItemId) || items[0] || null;
      return res.status(409).render('pengelola-aset/procurements/add-asset', {
        title: 'Tambah Barang Hasil Pengadaan',
        procurement,
        items,
        selectedItemId: selectedItem ? Number(selectedItem.id) : null,
        initialValues: formValues,
        flash: {
          type: 'error',
          message: 'Kode aset sudah digunakan. Gunakan kode lain.'
        }
      });
    }
    next(err);
  } finally {
    conn.release();
  }
};

function buildReportWhere(query, reportType) {
  const clauses = [];
  const params = [];
  if (reportType === 'requests') {
    clauses.push(`ep.request_number LIKE 'REQ-%' AND ep.status IN ('submitted', 'rejected')`);
  }
  if (reportType === 'procurements') {
    clauses.push(`ep.request_number NOT LIKE 'REQ-%'`);
  }
  if (query.status) {
    if (reportType === 'requests' && requestStatuses.includes(query.status)) {
      clauses.push('ep.status = ?');
      params.push(query.status);
    }
    if (reportType === 'procurements' && procurementStatuses.includes(query.status)) {
      clauses.push('ep.status = ?');
      params.push(query.status);
    }
    if (reportType === 'assets') {
      clauses.push('a.status = ?');
      params.push(query.status);
    }
  }
  if (query.start_date) {
    const dateField = reportType === 'requests' ? 'ep.created_at' : reportType === 'assets' ? 'a.acquisition_date' : 'ep.created_at';
    clauses.push(`DATE(${dateField}) >= ?`);
    params.push(query.start_date);
  }
  if (query.end_date) {
    const dateField = reportType === 'requests' ? 'ep.created_at' : reportType === 'assets' ? 'a.acquisition_date' : 'ep.created_at';
    clauses.push(`DATE(${dateField}) <= ?`);
    params.push(query.end_date);
  }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

async function getReportRows(filters) {
  const reportType = filters.report_type;
  const { where, params } = buildReportWhere(filters, reportType);

  if (reportType === 'requests') {
    const [rows] = await db.query(`
      SELECT ep.request_number, ep.title AS name, item.specification, item.quantity, ep.status,
             ep.created_at, ep.updated_at, emp.name AS employee_name
      FROM equipment_procurements ep
      LEFT JOIN employees emp ON emp.id = ep.created_by
      LEFT JOIN equipment_proc_items item ON item.equipment_proc_id = ep.id
      ${where}
      ORDER BY ep.created_at DESC, ep.id DESC, item.id ASC
    `, params);
    return { reportType, rows };
  }

  if (reportType === 'assets') {
    const assetWhere = where ? `${where} AND a.acquisition_type = 'procurement' AND a.type = 'equipment'` : `WHERE a.acquisition_type = 'procurement' AND a.type = 'equipment'`;
    const [rows] = await db.query(`
      SELECT a.code, a.name, a.acquisition_date, a.acquisition_cost, a.status,
             a.created_at, e.brand, e.model, e.serial_number, e.specification
      FROM assets a
      LEFT JOIN equipments e ON e.asset_id = a.id
      ${assetWhere}
      ORDER BY a.acquisition_date DESC, a.id DESC
    `, params);
    return { reportType, rows };
  }

  const [rows] = await db.query(`
    SELECT ep.request_number, ep.title, ep.status, ep.created_at, ep.updated_at,
           emp.name AS created_by_name,
           item.name AS item_name, item.quantity, item.estimated_price
    FROM equipment_procurements ep
    LEFT JOIN employees emp ON emp.id = ep.created_by
    LEFT JOIN equipment_proc_items item ON item.equipment_proc_id = ep.id
    ${where}
    ORDER BY ep.created_at DESC, ep.id DESC, item.id ASC
  `, params);
  return { reportType, rows };
}

function getReportMeta(reportType) {
  if (reportType === 'requests') {
    return {
      statuses: requestStatuses,
      exportName: 'rekap-usulan',
      header: ['nomor_usulan', 'nama_barang', 'spesifikasi', 'jumlah', 'status', 'created_at', 'updated_at', 'pengusul']
    };
  }

  if (reportType === 'assets') {
    return {
      statuses: assetStatuses,
      exportName: 'rekap-asset',
      header: ['kode_asset', 'nama_asset', 'brand', 'model', 'serial_number', 'spesifikasi', 'tanggal_perolehan', 'harga_perolehan', 'status', 'created_at']
    };
  }

  return {
    statuses: procurementStatuses,
    exportName: 'rekap-permohonan',
    header: ['nomor_permohonan', 'judul', 'nama_barang', 'jumlah', 'estimasi_harga', 'status', 'created_at', 'updated_at', 'created_by']
  };
}

const report = async (req, res, next) => {
  try {
    const { reportType, filters, statuses } = normalizeReportFilters(req.query);
    const { rows } = await getReportRows(filters);
    res.render('pengelola-aset/procurements/report', {
      title: 'Rekap Pengadaan',
      rows,
      reportType,
      filters,
      statuses,
      reportTypes,
      rupiah
    });
  } catch (err) {
    next(err);
  }
};

const printReport = async (req, res, next) => {
  try {
    const { reportType, filters, statuses } = normalizeReportFilters(req.query);
    const { rows } = await getReportRows(filters);
    res.render('pengelola-aset/procurements/report-print', {
      title: 'Cetak Rekap Pengadaan',
      rows,
      reportType,
      filters,
      statuses,
      reportTypes,
      rupiah
    });
  } catch (err) {
    next(err);
  }
};

const exportReportCsv = async (req, res, next) => {
  try {
    const { reportType, filters } = normalizeReportFilters(req.query);
    const { rows } = await getReportRows(filters);
    const meta = getReportMeta(reportType);
    const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csvRows = reportType === 'requests'
      ? rows.map(row => [row.request_number, row.name, row.specification, row.quantity, row.status, row.created_at, row.updated_at, row.employee_name])
      : reportType === 'assets'
        ? rows.map(row => [row.code, row.name, row.brand, row.model, row.serial_number, row.specification, row.acquisition_date, row.acquisition_cost, row.status, row.created_at])
        : rows.map(row => [row.request_number, row.title, row.item_name, row.quantity, row.estimated_price, row.status, row.created_at, row.updated_at, row.created_by_name]);

    const csv = [meta.header.join(',')]
      .concat(csvRows.map(row => row.map(escape).join(',')))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${meta.exportName}-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listRequests,
  detailRequest,
  updateRequestStatus,
  showCreateProcurement,
  createProcurement,
  listProcurements,
  procurementItemsPage,
  detailProcurement,
  submitProcurement,
  decideProcurement,
  showAddAsset,
  addAssetFromProcurement,
  report,
  printReport,
  exportReportCsv
};
