function normalizeRole(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function isAuthenticated(req, res, next) {
  // Prevent caching of protected pages
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  if (req.session && req.session.userId) {
    req.userRoles = req.session.roles || [];
    return next();
  }
  return res.redirect('/login');
}

const isLogin = isAuthenticated;

const isRole = (role) => {
  return (req, res, next) => {
    const userRoles = Array.isArray(req.userRoles) ? req.userRoles : [];
    const targetRole = normalizeRole(role);
    if (userRoles.some((item) => normalizeRole(item) === targetRole)) {
      return next();
    }
    return res.status(403).render('errors/403', { title: '403 Forbidden' });
  };
};

module.exports = {
  isAuthenticated,
  isLogin,
  isRole,
};
