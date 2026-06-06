const db = require("../lib/db");

/**
 * ACL Middleware
 * Cek apakah user memiliki permission yang dibutuhkan.
 *
 * Struktur DB:
 * permissions
 * role_has_permissions
 * model_has_roles
 * roles
 */
const checkPermission = (requiredPermissions) => {
  return async (req, res, next) => {
    if (!req.session.userId) {
      return res.redirect("/login");
    }

    const permissionsArray = Array.isArray(requiredPermissions)
      ? requiredPermissions
      : [requiredPermissions];

    try {
      const query = `
        SELECT DISTINCT p.name
        FROM permissions p
        JOIN role_has_permissions rhp
          ON p.id = rhp.permission_id
        JOIN model_has_roles mhr
          ON rhp.role_id = mhr.role_id
        WHERE mhr.model_id = ?
          AND mhr.model_type = 'User'
          AND p.name IN (?)
      `;

      const [rows] = await db.query(query, [
        req.session.userId,
        permissionsArray,
      ]);

      if (rows.length > 0) {
        return next();
      }

      return res.status(403).render("error", {
        message:
          "Akses ditolak. Anda tidak memiliki izin untuk mengakses halaman ini.",
        error: {
          status: 403,
          stack: "",
        },
      });
    } catch (err) {
      next(err);
    }
  };
};

/**
 * Load role user ke semua view
 *
 * app.use(loadUserRoles);
 */
const loadUserRoles = async (req, res, next) => {
  if (!req.session.userId) {
    req.userRoles = [];

    res.locals.userRoles = [];
    res.locals.username = "";
    res.locals.userId = null;

    return next();
  }

  try {
    const [rows] = await db.query(
      `
      SELECT r.name
      FROM roles r
      JOIN model_has_roles mhr
        ON r.id = mhr.role_id
      WHERE mhr.model_id = ?
        AND mhr.model_type = 'User'
      `,
      [req.session.userId]
    );

    req.userRoles = rows.map((r) => r.name);

    res.locals.userRoles = req.userRoles;
    res.locals.username = req.session.username || "";
    res.locals.userId = req.session.userId;
  } catch (err) {
    console.error(err);

    req.userRoles = [];

    res.locals.userRoles = [];
    res.locals.username = "";
    res.locals.userId = null;
  }

  next();
};

module.exports = {
  checkPermission,
  loadUserRoles,
};