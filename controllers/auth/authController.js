const bcrypt = require('bcryptjs');
const db = require('../../lib/db');

const index = (req, res) => res.redirect('/home');

const renderLogin = (res, overrides = {}) => {
  res.render('auth/login', {
    title: 'Login',
    error: null,
    success: null,
    form: { email: '' },
    ...overrides
  });
};

const loginPage = (req, res) => {
  if (req.session.userId) return res.redirect('/home');
  renderLogin(res);
};

const login = async (req, res, next) => {
  const email = String(req.body.email || req.body.username || '').trim();
  const password = String(req.body.password || '');

  try {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ? OR name = ? LIMIT 1', [email, email]);
    if (!rows.length) {
      return renderLogin(res, { error: 'Email atau password tidak valid.', form: { email } });
    }

    const user = rows[0];
    const isBcrypt = String(user.password || '').startsWith('$2');
    const isMatch = isBcrypt ? await bcrypt.compare(password, user.password) : password === user.password;
    if (!isMatch) {
      return renderLogin(res, { error: 'Email atau password tidak valid.', form: { email } });
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

    if (req.session.roles.includes('Admin')) {
      return res.redirect('/admin');
    }

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

module.exports = { index, loginPage, login, logout };
