const express = require("express");
const router = express.Router();

const usulanController = require("../controllers/usulanController");
const { isAuthenticated } = require("../middlewares/auth");
const { checkPermission } = require("../middlewares/acl");

// Semua route wajib login terlebih dahulu
router.use(isAuthenticated);

// FITUR 3 - Daftar Usulan (butuh permission: melihat pengadaan)
router.get("/", checkPermission("pengadaan.view"), usulanController.index);

// FITUR 1 - Tambah Usulan (butuh permission: membuat pengadaan)
router.get("/create", checkPermission("pengadaan.create"), usulanController.createPage);
router.post("/",      checkPermission("pengadaan.create"), usulanController.store);

// FITUR 5 - PDF Laporan (butuh permission: melihat pengadaan)
router.get("/laporan/pdf", checkPermission("pengadaan.view"), usulanController.downloadLaporan);

// FITUR 6 - API JSON Riwayat (butuh permission: melihat pengadaan)
router.get("/api/riwayat", checkPermission("pengadaan.view"), usulanController.apiRiwayat);

// FITUR 2 - Edit Usulan (butuh permission: mengedit pengadaan)
router.get("/:id/edit",    checkPermission("pengadaan.edit"), usulanController.editPage);
router.post("/:id/update", checkPermission("pengadaan.edit"), usulanController.update);

// FITUR 4 - Hapus Usulan (butuh permission: menghapus pengadaan)
router.post("/:id/delete", checkPermission("pengadaan.delete"), usulanController.destroy);

module.exports = router;
