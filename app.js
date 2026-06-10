require('dotenv').config();
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var session = require('express-session');
var MySQLStore = require('express-mysql-session')(session);

var authRouter = require('./routes/auth/index');
var adminRouter = require('./routes/admin/index');
var adminUsersRouter = require('./routes/admin/users');
var pengelolaAsetDashboardRouter = require('./routes/pengelola-aset/dashboard');
var procurementsRouter = require('./routes/pengelola-aset/procurements');
var apiProcurementsRouter = require('./routes/pengelola-aset/apiProcurements');
const { notFoundHandler, errorHandler } = require('./middlewares/error');

var app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Default pakai MemoryStore supaya tidak bentrok dengan tabel sessions Laravel
// yang memiliki kolom payload/last_activity, bukan data/expires.
let sessionStore;
if (process.env.USE_MYSQL_SESSION === 'true') {
  sessionStore = new MySQLStore({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    createDatabaseTable: false,
    schema: {
      tableName: process.env.EXPRESS_SESSION_TABLE || 'express_sessions',
      columnNames: {
        session_id: 'session_id',
        expires: 'expires',
        data: 'data'
      }
    }
  });
}

app.use(session({
  key: 'facultyware_session',
  secret: process.env.SESSION_SECRET || 'facultyware-secret',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});

app.use('/', authRouter);
app.use('/', pengelolaAsetDashboardRouter);
app.use('/admin', adminRouter);
app.use('/admin/users', adminUsersRouter);
app.use('/procurements', procurementsRouter);
app.use('/api', apiProcurementsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
