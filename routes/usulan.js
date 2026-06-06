const express = require("express");
const router = express.Router();

const usulanController = require("../controllers/usulanController");
const { isAuthenticated } = require("../middlewares/auth");

router.use(isAuthenticated);

// FITUR 3 - Daftar Usulan
router.get("/", usulanController.index);

// FITUR 1 - Tambah Usulan
router.get("/create", usulanController.createPage);
router.post("/", usulanController.store);

// FITUR 5 - PDF
router.get("/laporan/pdf", usulanController.downloadLaporan);

// FITUR 6 - API
router.get("/api/riwayat", usulanController.apiRiwayat);

// FITUR 2 - Edit
router.get("/:id/edit", usulanController.editPage);
router.post("/:id/update", usulanController.update);

// FITUR 4 - Hapus
router.post("/:id/delete", usulanController.destroy);

module.exports = router;