const db = require('../lib/db');

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function hasRole(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  const normalizedAllowed = roles.map(normalize);

  return async (req, res, next) => {
    if (!req.session || !req.session.userId) return res.redirect('/login');

    try {
      let userRoles = req.session.roles || [];
      if (!userRoles.length) {
        const [rows] = await db.query(`
          SELECT r.name
          FROM roles r
          JOIN model_has_roles mhr ON mhr.role_id = r.id
          WHERE mhr.model_id = ?
        `, [req.session.userId]);
        userRoles = rows.map(row => row.name);
        req.session.roles = userRoles;
      }

      const ok = userRoles.some(role => normalizedAllowed.includes(normalize(role)));
      if (ok) return next();

      return res.status(403).render('error', {
        message: 'Forbidden: Anda tidak memiliki akses ke halaman ini.',
        error: { status: 403, stack: '' }
      });
    } catch (err) {
      return next(err);
    }
  };
}

function checkPermission(requiredPermissions) {
  return async (req, res, next) => {
    if (!req.session || !req.session.userId) return res.redirect('/login');
    const permissionsArray = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
    try {
      const [rows] = await db.query(`
        SELECT DISTINCT p.name
        FROM permissions p
        JOIN role_has_permissions rhp ON p.id = rhp.permission_id
        JOIN model_has_roles mhr ON rhp.role_id = mhr.role_id
        WHERE mhr.model_id = ? AND p.name IN (?)
      `, [req.session.userId, permissionsArray]);
      if (rows.length) return next();
      return res.status(403).render('error', {
        message: 'Forbidden: Anda tidak memiliki permission yang dibutuhkan.',
        error: { status: 403, stack: '' }
      });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { hasRole, checkPermission };
