const express = require("express");
const router = express.Router();

const usulanController = require("../controllers/usulanController");
const { isAuthenticated } = require("../middlewares/auth");

router.use(isAuthenticated);

router.get("/", usulanController.index);

router.get("/create", usulanController.createPage);
router.post("/", usulanController.store);

router.get("/laporan/pdf", usulanController.downloadLaporan);

router.get("/api/riwayat", usulanController.apiRiwayat);

router.get("/:id/edit", usulanController.editPage);
router.post("/:id/update", usulanController.update);

router.post("/:id/delete", usulanController.destroy);

module.exports = router;
