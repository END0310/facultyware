const bcrypt = require("bcryptjs");
const db = require("../lib/db");

const index = (req, res) => {
  res.render("index", { title: "Express" });
};

const home = (req, res) => {
  res.render("home", {
    title: "Home",
    user: req.session.username,
  });
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
      return res.redirect('/wakildekan/permohonan');
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