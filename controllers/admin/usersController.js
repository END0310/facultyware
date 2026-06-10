const bcrypt = require('bcryptjs');
const db = require('../../lib/db');

function flash(req, type, message) {
  req.session.flash = { type, message };
}

function render(res, view, payload = {}) {
  return res.render(view, {
    title: 'Manajemen Akun',
    ...payload
  });
}

async function findUserById(id) {
  const [rows] = await db.query(`
    SELECT u.id, u.name, u.email,
           COALESCE(GROUP_CONCAT(DISTINCT r.name ORDER BY r.name SEPARATOR ', '), '') AS roles
    FROM users u
    LEFT JOIN model_has_roles mhr ON mhr.model_id = u.id
    LEFT JOIN roles r ON r.id = mhr.role_id
    WHERE u.id = ?
    GROUP BY u.id, u.name, u.email
    LIMIT 1
  `, [id]);
  return rows[0] || null;
}

const index = async (req, res, next) => {
  try {
    const [users] = await db.query(`
      SELECT u.id, u.name, u.email,
             COALESCE(GROUP_CONCAT(DISTINCT r.name ORDER BY r.name SEPARATOR ', '), '') AS roles
      FROM users u
      LEFT JOIN model_has_roles mhr ON mhr.model_id = u.id
      LEFT JOIN roles r ON r.id = mhr.role_id
      GROUP BY u.id, u.name, u.email
      ORDER BY u.name ASC, u.id ASC
    `);

    render(res, 'admin/users/index', {
      title: 'Manajemen Akun Admin',
      users
    });
  } catch (err) {
    next(err);
  }
};

const editPage = async (req, res, next) => {
  try {
    const user = await findUserById(req.params.id);
    if (!user) {
      return res.status(404).render('error', {
        message: 'Akun tidak ditemukan',
        error: { status: 404, stack: '' }
      });
    }

    render(res, 'admin/users/edit', {
      title: 'Edit Akun',
      user,
      errors: [],
      old: { name: user.name, email: user.email }
    });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  const userId = Number(req.params.id);
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim();
  const errors = [];

  if (!name) errors.push('Nama wajib diisi.');
  if (!email) errors.push('Email wajib diisi.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Format email tidak valid.');

  try {
    const user = await findUserById(userId);
    if (!user) {
      return res.status(404).render('error', {
        message: 'Akun tidak ditemukan',
        error: { status: 404, stack: '' }
      });
    }

    const [emailRows] = await db.query('SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1', [email, userId]);
    if (emailRows.length) errors.push('Email sudah digunakan oleh akun lain.');

    if (errors.length) {
      return render(res, 'admin/users/edit', {
        title: 'Edit Akun',
        user,
        errors,
        old: { name, email }
      });
    }

    await db.query('UPDATE users SET name = ?, email = ? WHERE id = ?', [name, email, userId]);
    flash(req, 'success', 'Data akun berhasil diperbarui.');
    res.redirect('/admin/users');
  } catch (err) {
    next(err);
  }
};

const resetPasswordPage = async (req, res, next) => {
  try {
    const user = await findUserById(req.params.id);
    if (!user) {
      return res.status(404).render('error', {
        message: 'Akun tidak ditemukan',
        error: { status: 404, stack: '' }
      });
    }

    render(res, 'admin/users/reset-password', {
      title: 'Reset Password Akun',
      user,
      errors: []
    });
  } catch (err) {
    next(err);
  }
};

const resetPassword = async (req, res, next) => {
  const userId = Number(req.params.id);
  const password = String(req.body.password || '');
  const passwordConfirmation = String(req.body.password_confirmation || '');
  const errors = [];

  if (!password) errors.push('Password baru wajib diisi.');
  if (password.length > 0 && password.length < 6) errors.push('Password baru minimal 6 karakter.');
  if (password !== passwordConfirmation) errors.push('Konfirmasi password tidak cocok.');

  try {
    const user = await findUserById(userId);
    if (!user) {
      return res.status(404).render('error', {
        message: 'Akun tidak ditemukan',
        error: { status: 404, stack: '' }
      });
    }

    if (errors.length) {
      return render(res, 'admin/users/reset-password', {
        title: 'Reset Password Akun',
        user,
        errors
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);
    flash(req, 'success', 'Password akun berhasil direset oleh admin.');
    res.redirect('/admin/users');
  } catch (err) {
    next(err);
  }
};

module.exports = { index, editPage, update, resetPasswordPage, resetPassword };
