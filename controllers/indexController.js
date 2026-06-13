const bcrypt = require("bcryptjs");
const db = require("../lib/db");

const index = (req, res) => {
  res.render("index", { title: "Express" });
};

const home = async (req, res, next) => {
  try {
    const userId = req.session.userId;

    const summary = {
      total: 0,
      draft: 0,
      submitted: 0,
      approved: 0,
      rejected: 0,
      completed: 0,
    };

    const [statusRows] = await db.query(
      `
      SELECT status, COUNT(*) total
      FROM equipment_procurements
      WHERE created_by = ?
      GROUP BY status
      `,
      [userId]
    );

    statusRows.forEach((row) => {
      summary.total += Number(row.total);

      if (summary.hasOwnProperty(row.status)) {
        summary[row.status] = Number(row.total);
      }
    });

    const [aggregateRows] = await db.query(
      `
      SELECT
        COALESCE(SUM(epi.quantity),0) AS totalItem,
        COALESCE(SUM(epi.quantity * epi.estimated_price),0) AS totalBiaya
      FROM equipment_procurements ep
      LEFT JOIN equipment_proc_items epi
        ON ep.id = epi.equipment_proc_id
      WHERE ep.created_by = ?
      `,
      [userId]
    );

    const totalItem = Number(
      aggregateRows[0]?.totalItem || 0
    );

    const totalBiaya = Number(
      aggregateRows[0]?.totalBiaya || 0
    );

    const formatRupiah = (angka) => {
      return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
      }).format(angka);
    };

    res.render("home", {
      title: "Home",
      user: req.session.username,
      summary,
      totalItem,
      totalBiaya,
      formatRupiah,
    });
  } catch (err) {
    next(err);
  }
};

const loginPage = (req, res) => {
  if (req.session.userId) {
    return res.redirect("/home");
  }

  res.render("login", {
    title: "Login",
    error: null,
  });
};

const login = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    const [rows] = await db.query(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (rows.length === 0) {
      return res.render("login", {
        title: "Login",
        error: "Invalid email or password",
      });
    }

    const user = rows[0];

    const isMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!isMatch) {
      return res.render("login", {
        title: "Login",
        error: "Invalid email or password",
      });
    }

    // Set session
    req.session.userId = user.id;

    // tetap gunakan nama variabel username
    // agar view dosen tidak perlu diubah
    req.session.username = user.name;

    // Ambil role user untuk redirect
    const [roleRows] = await db.query(
      "SELECT r.name FROM roles r JOIN model_has_roles mhr ON r.id = mhr.role_id WHERE mhr.model_id = ?",
      [user.id]
    );
    const roles = roleRows.map(r => r.name);

    // Redirect sesuai role
    if (roles.includes('wakildekan')) {
      return res.redirect('/wakildekan/dashboard');
    }

    res.redirect("/home");
  } catch (err) {
    next(err);
  }
};

const logout = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) {
      return next(err);
    }

    res.redirect("/login");
  });
};

module.exports = {
  index,
  home,
  loginPage,
  login,
  logout,
};