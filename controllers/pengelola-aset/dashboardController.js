const db = require('../../lib/db');

const emptySummary = () => ({
  requests: { total: 0, pending_asset: 0, submitted: 0, asset_rejected: 0 },
  procurements: { total: 0, draft: 0, pending_asset: 0, submitted: 0, approved: 0, rejected: 0, completed: 0 },
  assets: { total: 0, totalCost: 0 },
  recentProcurements: [],
  recentRequests: []
});

function formatRupiah(angka) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(angka);
}

async function renderKetuaDepartemenHome(req, res, next) {
  try {
    const userId = req.session.employeeId || req.session.userId;
    const summary = {
      total: 0,
      draft: 0,
      pending_asset: 0,
      asset_rejected: 0,
      submitted: 0,
      approved: 0,
      rejected: 0,
      completed: 0,
    };

    const [statusRows] = await db.query(`
      SELECT status, COUNT(*) total
      FROM equipment_procurements
      WHERE created_by = ?
      GROUP BY status
    `, [userId]);

    statusRows.forEach((row) => {
      summary.total += Number(row.total || 0);
      if (Object.prototype.hasOwnProperty.call(summary, row.status)) {
        summary[row.status] = Number(row.total || 0);
      }
    });

    const [aggregateRows] = await db.query(`
      SELECT
        COALESCE(SUM(epi.quantity), 0) AS totalItem,
        COALESCE(SUM(epi.quantity * epi.estimated_price), 0) AS totalBiaya
      FROM equipment_procurements ep
      LEFT JOIN equipment_proc_items epi ON ep.id = epi.equipment_proc_id
      WHERE ep.created_by = ?
    `, [userId]);

    res.render('home', {
      title: 'Home',
      user: req.session.username,
      summary,
      totalItem: Number(aggregateRows[0]?.totalItem || 0),
      totalBiaya: Number(aggregateRows[0]?.totalBiaya || 0),
      formatRupiah,
    });
  } catch (err) {
    next(err);
  }
}

const home = async (req, res, next) => {
  const user = req.session.user || null;
  const roles = user?.roles || [];
  const isKetuaDepartemen = roles.includes('Ketua Departemen') || roles.includes('ketua_departemen');
  const isPengelolaAset = roles.includes('Pengelola Aset');
  const isAdmin = roles.includes('Admin');
  const isWakilDekan = roles.includes('Wakil Dekan') || roles.includes('wakildekan');

  if (isAdmin && !isPengelolaAset) {
    return res.redirect('/admin');
  }

  if (isWakilDekan && !isPengelolaAset) {
    return res.redirect('/wakildekan/permohonan');
  }

  if (isKetuaDepartemen && !isPengelolaAset) {
    return renderKetuaDepartemenHome(req, res, next);
  }

  if (!isPengelolaAset) {
    return res.render('home_default', {
      title: 'Home',
      user
    });
  }

  const summary = emptySummary();

  try {
    const [requestStatusRows] = await db.query(`
      SELECT status, COUNT(*) AS total
      FROM equipment_procurements
      WHERE status IN ('pending_asset', 'submitted', 'asset_rejected')
      GROUP BY status
    `);

    requestStatusRows.forEach((row) => {
      const status = row.status || 'unknown';
      const total = Number(row.total || 0);
      summary.requests.total += total;
      if (Object.prototype.hasOwnProperty.call(summary.requests, status)) {
        summary.requests[status] = total;
      }
    });

    const [procurementStatusRows] = await db.query(`
      SELECT status, COUNT(*) AS total
      FROM equipment_procurements
      GROUP BY status
    `);

    procurementStatusRows.forEach((row) => {
      const status = row.status || 'unknown';
      const total = Number(row.total || 0);
      summary.procurements.total += total;
      if (Object.prototype.hasOwnProperty.call(summary.procurements, status)) {
        summary.procurements[status] = total;
      }
    });

    const [assetRows] = await db.query(`
      SELECT COUNT(*) AS total_assets, COALESCE(SUM(acquisition_cost), 0) AS total_acquisition_cost
      FROM assets
      WHERE acquisition_type = 'procurement'
    `);
    summary.assets.total = Number(assetRows[0]?.total_assets || 0);
    summary.assets.totalCost = Number(assetRows[0]?.total_acquisition_cost || 0);

    const [recentProcurements] = await db.query(`
      SELECT id, request_number, title, status, created_at
      FROM equipment_procurements
      ORDER BY created_at DESC, id DESC
      LIMIT 5
    `);
    summary.recentProcurements = recentProcurements;

    const [recentRequests] = await db.query(`
      SELECT
        ep.id,
        ep.request_number,
        ep.title,
        ep.status,
        ep.created_at,
        COALESCE(SUM(item.quantity), 0) AS total_quantity
      FROM equipment_procurements ep
      LEFT JOIN equipment_proc_items item ON item.equipment_proc_id = ep.id
      WHERE ep.status IN ('pending_asset', 'submitted', 'asset_rejected')
      GROUP BY ep.id
      ORDER BY created_at DESC, id DESC
      LIMIT 5
    `);
    summary.recentRequests = recentRequests;
  } catch (err) {
    console.error('Dashboard summary error:', err.message);
  }

  res.render('pengelola-aset/dashboard/index', {
    title: 'Dashboard Pengelola Aset',
    user,
    roles,
    summary
  });
};

module.exports = { home };
