// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
  // Prevent caching of protected pages
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  if (req.session.userId) {
    return next();
  }
  res.redirect("/login");
}

const isLogin = isAuthenticated;

const isRole = (role) => {
  return (req, res, next) => {
    if (req.userRoles && req.userRoles.includes(role)) {
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
