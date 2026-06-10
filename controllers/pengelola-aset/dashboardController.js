const db = require('../../lib/db');

const emptySummary = () => ({
  requests: { total: 0, pending: 0, approved: 0, rejected: 0 },
  procurements: { total: 0, draft: 0, submitted: 0, approved: 0, rejected: 0, completed: 0 },
  assets: { total: 0, totalCost: 0 },
  recentProcurements: [],
  recentRequests: []
});

const home = async (req, res, next) => {
  const user = req.session.user || null;
  const roles = user?.roles || [];
  const isPengelolaAset = roles.includes('Pengelola Aset');
  const isAdmin = roles.includes('Admin');

  if (isAdmin && !isPengelolaAset) {
    return res.redirect('/admin');
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
      FROM equipment_requests
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
      SELECT id, request_number, name, quantity, status, created_at
      FROM equipment_requests
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
