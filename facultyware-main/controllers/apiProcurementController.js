const db = require('../lib/db');

const ok = (res, data, message = 'Data berhasil diambil') => res.json({ success: true, message, data });
const fail = (res, status, message, error = null) => res.status(status).json({ success: false, message, error });

const listProcurements = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT ep.*, emp.name AS created_by_name, COUNT(item.id) AS item_count, COALESCE(SUM(item.quantity * item.estimated_price), 0) AS total_estimated_price
      FROM equipment_procurements ep
      LEFT JOIN employees emp ON emp.id = ep.created_by
      LEFT JOIN equipment_proc_items item ON item.equipment_proc_id = ep.id
      GROUP BY ep.id, emp.name
      ORDER BY ep.created_at DESC, ep.id DESC
    `);
    ok(res, rows);
  } catch (err) {
    fail(res, 500, 'Gagal mengambil data', err.message);
  }
};

const detailProcurement = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT ep.*, emp.name AS created_by_name
      FROM equipment_procurements ep
      LEFT JOIN employees emp ON emp.id = ep.created_by
      WHERE ep.id = ?
      LIMIT 1
    `, [req.params.id]);
    if (!rows.length) return fail(res, 404, 'Data tidak ditemukan');
    ok(res, rows[0]);
  } catch (err) {
    fail(res, 500, 'Gagal mengambil data', err.message);
  }
};

const procurementItems = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM equipment_proc_items WHERE equipment_proc_id = ? ORDER BY id ASC', [req.params.id]);
    if (!rows.length) return fail(res, 404, 'Data tidak ditemukan');
    ok(res, rows);
  } catch (err) {
    fail(res, 500, 'Gagal mengambil data', err.message);
  }
};

const procurementAssets = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT a.*, e.brand, e.model, e.serial_number, e.specification
      FROM assets a
      LEFT JOIN equipments e ON e.asset_id = a.id
      WHERE a.acquisition_type = 'procurement' AND a.type = 'equipment'
      ORDER BY a.created_at DESC, a.id DESC
    `);
    ok(res, rows);
  } catch (err) {
    fail(res, 500, 'Gagal mengambil data', err.message);
  }
};

const summary = async (req, res) => {
  try {
    const [procurementRows] = await db.query(`
      SELECT status, COUNT(*) AS total
      FROM equipment_procurements
      GROUP BY status
    `);
    const [assetRows] = await db.query(`
      SELECT COUNT(*) AS total_assets, COALESCE(SUM(acquisition_cost), 0) AS total_acquisition_cost
      FROM assets
      WHERE acquisition_type = 'procurement' AND type = 'equipment'
    `);
    ok(res, {
      procurements_by_status: procurementRows,
      procurement_assets: assetRows[0]
    });
  } catch (err) {
    fail(res, 500, 'Gagal mengambil data', err.message);
  }
};

module.exports = { listProcurements, detailProcurement, procurementItems, procurementAssets, summary };
