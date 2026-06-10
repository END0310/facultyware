const db = require('../../lib/db');

const ok = (res, data, message = 'Data berhasil diambil') => res.json({ success: true, message, data });
const fail = (res, status, message, error = null) => res.status(status).json({ success: false, message, error });

const listProcurementItems = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        item.*,
        ep.request_number,
        ep.title AS procurement_title,
        ep.status AS procurement_status,
        emp.name AS created_by_name
      FROM equipment_proc_items item
      JOIN equipment_procurements ep ON ep.id = item.equipment_proc_id
      LEFT JOIN employees emp ON emp.id = ep.created_by
      ORDER BY item.created_at DESC, item.id DESC
    `);
    ok(res, rows);
  } catch (err) {
    fail(res, 500, 'Gagal mengambil data', err.message);
  }
};

module.exports = { listProcurementItems };
