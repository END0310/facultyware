const db = require('../../lib/db');

const index = async (req, res, next) => {
  try {
    const [userRows] = await db.query('SELECT COUNT(*) AS total FROM users');
    const [roleRows] = await db.query(`
      SELECT r.name, COUNT(*) AS total
      FROM roles r
      LEFT JOIN model_has_roles mhr ON mhr.role_id = r.id
      GROUP BY r.id, r.name
      ORDER BY r.name ASC
    `);
    const [recentUsers] = await db.query(`
      SELECT u.id, u.name, u.email,
             COALESCE(GROUP_CONCAT(DISTINCT r.name ORDER BY r.name SEPARATOR ', '), '') AS roles
      FROM users u
      LEFT JOIN model_has_roles mhr ON mhr.model_id = u.id
      LEFT JOIN roles r ON r.id = mhr.role_id
      GROUP BY u.id, u.name, u.email
      ORDER BY u.id DESC
      LIMIT 5
    `);

    res.render('admin/dashboard/index', {
      title: 'Dashboard Admin',
      totalUsers: Number(userRows[0]?.total || 0),
      rolesSummary: roleRows,
      recentUsers
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { index };
