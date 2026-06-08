const bcrypt = require('bcryptjs');
const db = require('../lib/db');

const index = (req, res) => res.redirect('/home');

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

  // Sesuai permintaan: dashboard khusus hanya untuk role Pengelola Aset.
  // Role lain dikembalikan ke tampilan home bawaan/template lama.
  const isPengelolaAset = roles.includes('Pengelola Aset');

  if (!isPengelolaAset) {
    return res.render('home', {
      title: 'Home',
      user,
      roles,
      isPengelolaAset: false,
      summary: emptySummary()
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
    // Dashboard tetap tampil walaupun query rekap gagal.
    console.error('Dashboard summary error:', err.message);
  }

  res.render('home', {
    title: 'Dashboard Pengelola Aset',
    user,
    roles,
    isPengelolaAset: true,
    summary
  });
};

const loginPage = (req, res) => {
  if (req.session.userId) return res.redirect('/home');
  res.render('login', { title: 'Login', error: null });
};

const login = async (req, res, next) => {
  const { username, password } = req.body;

  try {
    // Field form login bawaan tetap bernama username, tetapi nilainya dapat diisi email.
    const [rows] = await db.query('SELECT * FROM users WHERE email = ? OR name = ? LIMIT 1', [username, username]);
    if (!rows.length) {
      return res.render('login', { title: 'Login', error: 'Invalid username or password' });
    }

    const user = rows[0];
    const isBcrypt = String(user.password || '').startsWith('$2');
    const isMatch = isBcrypt ? await bcrypt.compare(password, user.password) : password === user.password;
    if (!isMatch) {
      return res.render('login', { title: 'Login', error: 'Invalid username or password' });
    }

    const [employeeRows] = await db.query('SELECT id, name FROM employees WHERE id = ? LIMIT 1', [user.id]);
    const [roleRows] = await db.query(`
      SELECT r.name
      FROM roles r
      JOIN model_has_roles mhr ON mhr.role_id = r.id
      WHERE mhr.model_id = ?
    `, [user.id]);

    req.session.userId = user.id;
    req.session.username = user.name;
    req.session.email = user.email;
    req.session.employeeId = employeeRows[0]?.id || user.id;
    req.session.roles = roleRows.map(row => row.name);
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      employeeId: req.session.employeeId,
      roles: req.session.roles
    };

    res.redirect('/home');
  } catch (err) {
    next(err);
  }
};

const logout = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.redirect('/login');
  });
};

module.exports = { index, home, loginPage, login, logout };
