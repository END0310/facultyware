const db = require('../lib/db');
const PDFDocument = require('pdfkit');
const { applyProcurementDecision } = require('../lib/procurement-assets');

const listPermohonan = async (req, res) => {
    try {
        const search = String(req.query.search || '').trim();
        const page   = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit  = 10;
        const offset = (page - 1) * limit;

        let whereClause = "WHERE ep.status = 'submitted' AND ep.request_number NOT LIKE 'REQ-%'";
        const params = [];

        if (search) {
            whereClause += ' AND (ep.request_number LIKE ? OR ep.title LIKE ?)';
            const like = `%${search}%`;
            params.push(like, like);
        }

        const [countRows] = await db.query(
            `SELECT COUNT(*) AS total FROM equipment_procurements ep ${whereClause}`,
            params
        );
        const totalItems = countRows[0].total;
        const totalPages = Math.max(1, Math.ceil(totalItems / limit));

        const [rows] = await db.query(`
            SELECT ep.id, ep.request_number, ep.title, ep.status, e.name AS created_by_name, ep.created_at 
            FROM equipment_procurements ep 
            JOIN employees e ON ep.created_by = e.id 
            ${whereClause}
            ORDER BY ep.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset]);
        res.render('wakildekan/index', { 
            permohonan: rows, 
            title: 'Daftar Permohonan Pengadaan',
            search,
            currentPage: page,
            totalPages,
            totalItems
        });
    } catch (error) {
        console.error('listPermohonan error:', error);
        res.status(500).render('wakildekan/error', {
            title: 'Terjadi Kesalahan',
            message: 'Gagal memuat daftar permohonan. Silakan coba lagi nanti.',
            backUrl: '/wakildekan/dashboard'
        });
    }
};

const detailPermohonan = async (req, res) => {
    try {
        const id = req.params.id;
        const permohonanQuery = `
            SELECT ep.*, e.name AS created_by_name 
            FROM equipment_procurements ep 
            JOIN employees e ON ep.created_by = e.id 
            WHERE ep.id = ?
        `;
        const [permohonanRows] = await db.query(permohonanQuery, [id]);
        
        if (permohonanRows.length === 0) {
            return res.redirect('/wakildekan/permohonan');
        }

        const itemsQuery = `
            SELECT * FROM equipment_proc_items 
            WHERE equipment_proc_id = ?
        `;
        const [itemRows] = await db.query(itemsQuery, [id]);

        res.render('wakildekan/detail', {
            permohonan: permohonanRows[0],
            items: itemRows,
            title: 'Detail Permohonan',
            errorMessage: req.session.errorMessage || null
        });
        delete req.session.errorMessage;
    } catch (error) {
        console.error('detailPermohonan error:', error);
        res.status(500).render('wakildekan/error', {
            title: 'Terjadi Kesalahan',
            message: 'Gagal memuat detail permohonan. Silakan coba lagi nanti.',
            backUrl: '/wakildekan/permohonan'
        });
    }
};

const approvePermohonan = async (req, res) => {
    const conn = await db.getConnection();
    try {
        const id = req.params.id;
        await conn.beginTransaction();
        const result = await applyProcurementDecision(conn, id, 'approved');
        if (!result.updated) {
            await conn.rollback();
            return res.redirect('/wakildekan/permohonan');
        }
        await conn.commit();
        res.redirect('/wakildekan/permohonan');
    } catch (error) {
        await conn.rollback();
        console.error('approvePermohonan error:', error);
        req.session.errorMessage = 'Gagal menyetujui permohonan: ' + (error.message || 'Terjadi kesalahan server');
        res.redirect('/wakildekan/permohonan/' + req.params.id);
    } finally {
        conn.release();
    }
};

const rejectPermohonan = async (req, res) => {
    const conn = await db.getConnection();
    try {
        const id = req.params.id;
        await conn.beginTransaction();
        const result = await applyProcurementDecision(conn, id, 'rejected');
        if (!result.updated) {
            await conn.rollback();
            return res.redirect('/wakildekan/permohonan');
        }
        await conn.commit();
        res.redirect('/wakildekan/permohonan');
    } catch (error) {
        await conn.rollback();
        console.error('rejectPermohonan error:', error);
        req.session.errorMessage = 'Gagal menolak permohonan: ' + (error.message || 'Terjadi kesalahan server');
        res.redirect('/wakildekan/permohonan/' + req.params.id);
    } finally {
        conn.release();
    }
};

const riwayatPermohonan = async (req, res) => {
    try {
        const search = String(req.query.search || '').trim();
        const page   = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit  = 10;
        const offset = (page - 1) * limit;

        let whereClause = "WHERE ep.status IN ('approved', 'rejected') AND ep.request_number NOT LIKE 'REQ-%'";
        const params = [];

        if (search) {
            whereClause += ' AND (ep.request_number LIKE ? OR ep.title LIKE ?)';
            const like = `%${search}%`;
            params.push(like, like);
        }

        const [countRows] = await db.query(
            `SELECT COUNT(*) AS total FROM equipment_procurements ep ${whereClause}`,
            params
        );
        const totalItems = countRows[0].total;
        const totalPages = Math.max(1, Math.ceil(totalItems / limit));

        const [rows] = await db.query(`
            SELECT ep.id, ep.request_number, ep.title, ep.status, e.name AS created_by_name, ep.created_at 
            FROM equipment_procurements ep 
            JOIN employees e ON ep.created_by = e.id 
            ${whereClause}
            ORDER BY ep.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset]);
        res.render('wakildekan/riwayat', { 
            permohonan: rows, 
            title: 'Riwayat Keputusan',
            search,
            currentPage: page,
            totalPages,
            totalItems
        });
    } catch (error) {
        console.error('riwayatPermohonan error:', error);
        res.status(500).render('wakildekan/error', {
            title: 'Terjadi Kesalahan',
            message: 'Gagal memuat riwayat keputusan. Silakan coba lagi nanti.',
            backUrl: '/wakildekan/dashboard'
        });
    }
};

const downloadPDF = async (req, res) => {
    try {
        const query = `
            SELECT ep.id, ep.request_number, ep.title, ep.status, e.name AS created_by_name, ep.created_at 
            FROM equipment_procurements ep 
            JOIN employees e ON ep.created_by = e.id 
            WHERE ep.status IN ('approved', 'rejected') AND ep.request_number NOT LIKE 'REQ-%'
            ORDER BY ep.created_at DESC
        `;
        const [rows] = await db.query(query);

        const margin = 50;
        const doc = new PDFDocument({ margin, size: 'A4', bufferPages: true });
        
        res.setHeader('Content-disposition', 'attachment; filename="laporan-pengadaan-wakildekan.pdf"');
        res.setHeader('Content-type', 'application/pdf');
        
        doc.pipe(res);

        const pageWidth = doc.page.width;
        const contentWidth = pageWidth - margin * 2;
        const now = new Date();
        const bulanIndo = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
        const tanggalCetak = `${now.getDate()} ${bulanIndo[now.getMonth()]} ${now.getFullYear()}`;

        // === HEADER / KOP SURAT ===
        doc.fontSize(13).font('Helvetica-Bold').text('FAKULTAS TEKNOLOGI INFORMASI', margin, margin, { align: 'center', width: contentWidth });
        doc.fontSize(10).font('Helvetica').text('UNIVERSITAS ANDALAS', { align: 'center', width: contentWidth });
        doc.moveDown(0.3);
        doc.moveTo(margin, doc.y).lineTo(pageWidth - margin, doc.y).lineWidth(2).stroke();
        doc.moveDown(0.2);
        doc.moveTo(margin, doc.y).lineTo(pageWidth - margin, doc.y).lineWidth(0.5).stroke();
        doc.moveDown(1.2);

        // === TITLE ===
        doc.fontSize(12).font('Helvetica-Bold').text('LAPORAN REKAPAN KEPUTUSAN PENGADAAN BARANG', { align: 'center', width: contentWidth, underline: true });
        doc.moveDown(0.3);
        doc.fontSize(10).font('Helvetica').text(`Periode: Seluruh Data | Dicetak: ${tanggalCetak}`, { align: 'center', width: contentWidth });
        doc.moveDown(1.5);

        // === TABLE ===
        const colWidths = [30, 80, 155, 90, 70, 70];
        const colX = [margin];
        for (let i = 1; i < colWidths.length; i++) {
            colX.push(colX[i - 1] + colWidths[i - 1]);
        }
        const headers = ['No', 'Nomor Request', 'Judul Pengadaan', 'Diajukan Oleh', 'Tanggal', 'Status'];
        const rowHeight = 22;
        const headerBg = '#2c3e50';
        const headerColor = '#ffffff';

        function drawTableHeader(yPos) {
            // Header background
            doc.rect(margin, yPos, contentWidth, rowHeight + 4).fill(headerBg);
            doc.fillColor(headerColor).font('Helvetica-Bold').fontSize(9);
            headers.forEach((h, i) => {
                doc.text(h, colX[i] + 5, yPos + 6, { width: colWidths[i] - 10, align: 'left' });
            });
            doc.fillColor('#000000');
            return yPos + rowHeight + 4;
        }

        let y = drawTableHeader(doc.y);

        doc.font('Helvetica').fontSize(8.5);
        
        let approvedCount = 0;
        let rejectedCount = 0;

        rows.forEach((row, i) => {
            if (y > 720) {
                doc.addPage();
                y = drawTableHeader(margin);
                doc.font('Helvetica').fontSize(8.5);
            }

            // Alternate row background
            if (i % 2 === 0) {
                doc.rect(margin, y, contentWidth, rowHeight).fill('#f8f9fa');
            }

            // Row borders
            doc.rect(margin, y, contentWidth, rowHeight).lineWidth(0.3).stroke('#dee2e6');

            const reqNum = row.request_number || '-';
            const title = row.title || '-';
            const name = row.created_by_name || '-';
            const date = new Date(row.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
            let status = 'Diajukan';
            if (row.status === 'approved') { status = 'Disetujui'; approvedCount++; }
            else if (row.status === 'rejected') { status = 'Ditolak'; rejectedCount++; }

            doc.fillColor('#333333');
            doc.text(String(i + 1), colX[0] + 5, y + 5, { width: colWidths[0] - 10 });
            doc.font('Helvetica').text(reqNum, colX[1] + 5, y + 5, { width: colWidths[1] - 10 });
            doc.text(title, colX[2] + 5, y + 5, { width: colWidths[2] - 10, ellipsis: true, height: rowHeight - 4 });
            doc.text(name, colX[3] + 5, y + 5, { width: colWidths[3] - 10, ellipsis: true, height: rowHeight - 4 });
            doc.text(date, colX[4] + 5, y + 5, { width: colWidths[4] - 10 });

            // Status with color
            if (row.status === 'approved') {
                doc.fillColor('#16a34a');
            } else if (row.status === 'rejected') {
                doc.fillColor('#dc2626');
            }
            doc.font('Helvetica-Bold').text(status, colX[5] + 5, y + 5, { width: colWidths[5] - 10 });
            doc.font('Helvetica').fillColor('#333333');

            y += rowHeight;
        });

        // Bottom border
        doc.moveTo(margin, y).lineTo(pageWidth - margin, y).lineWidth(1).stroke('#2c3e50');

        // === SUMMARY ===
        y += 20;
        if (y > 700) {
            doc.addPage();
            y = margin;
        }

        doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000');
        doc.text('Ringkasan:', margin, y);
        y += 18;
        doc.font('Helvetica').fontSize(9);
        doc.text(`Total Permohonan Diproses  : ${rows.length}`, margin + 10, y);
        y += 15;
        doc.fillColor('#16a34a').text(`Disetujui                  : ${approvedCount}`, margin + 10, y);
        y += 15;
        doc.fillColor('#dc2626').text(`Ditolak                    : ${rejectedCount}`, margin + 10, y);
        doc.fillColor('#000000');

        // === SIGNATURE ===
        y += 40;
        if (y > 650) {
            doc.addPage();
            y = margin;
        }

        const signX = pageWidth - margin - 200;
        doc.font('Helvetica').fontSize(9).text(tanggalCetak, signX, y, { width: 200, align: 'center' });
        y += 15;
        doc.font('Helvetica-Bold').fontSize(9).text('Wakil Dekan,', signX, y, { width: 200, align: 'center' });
        y += 60;
        doc.moveTo(signX + 20, y).lineTo(signX + 180, y).lineWidth(0.5).stroke();
        y += 5;
        doc.font('Helvetica').fontSize(8).text('NIP. ____________________', signX, y, { width: 200, align: 'center' });

        // === PAGE NUMBERS ===
        const totalPages = doc.bufferedPageRange().count;
        for (let i = 0; i < totalPages; i++) {
            doc.switchToPage(i);
            doc.fontSize(7).font('Helvetica').fillColor('#999999');
            doc.text(
                `Halaman ${i + 1} dari ${totalPages} — Dicetak oleh Sistem FacultyWare pada ${tanggalCetak}`,
                margin, doc.page.height - 30,
                { width: contentWidth, align: 'center' }
            );
        }

        doc.end();
    } catch (error) {
        console.error('downloadPDF error:', error);
        res.status(500).render('wakildekan/error', {
            title: 'Gagal Mengunduh PDF',
            message: 'Terjadi kesalahan saat membuat laporan PDF. Silakan coba lagi nanti.',
            backUrl: '/wakildekan/riwayat'
        });
    }
};

const getPermohonanAPI = async (req, res) => {
    try {
        const query = `
            SELECT ep.id, ep.request_number, ep.title, ep.status, e.name AS created_by_name, ep.created_at 
            FROM equipment_procurements ep 
            JOIN employees e ON ep.created_by = e.id 
            ORDER BY ep.created_at DESC
        `;
        const [rows] = await db.query(query);
        res.status(200).json({
            success: true,
            message: "Data permohonan berhasil diambil",
            data: rows
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
};

const dashboard = async (req, res) => {
    try {
        const statsQuery = `
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) AS pending,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected
            FROM equipment_procurements
            WHERE request_number NOT LIKE 'REQ-%'
        `;

        const recentSubmittedQuery = `
            SELECT ep.id, ep.request_number, ep.title, ep.status, e.name AS created_by_name, ep.created_at
            FROM equipment_procurements ep
            JOIN employees e ON ep.created_by = e.id
            WHERE ep.status = 'submitted' AND ep.request_number NOT LIKE 'REQ-%'
            ORDER BY ep.created_at DESC
            LIMIT 5
        `;

        const recentDecisionsQuery = `
            SELECT ep.id, ep.request_number, ep.title, ep.status, e.name AS created_by_name, ep.updated_at
            FROM equipment_procurements ep
            JOIN employees e ON ep.created_by = e.id
            WHERE ep.status IN ('approved', 'rejected') AND ep.request_number NOT LIKE 'REQ-%'
            ORDER BY ep.updated_at DESC
            LIMIT 5
        `;

        const [[statsRows], [submittedRows], [decisionRows]] = await Promise.all([
            db.query(statsQuery),
            db.query(recentSubmittedQuery),
            db.query(recentDecisionsQuery)
        ]);

        res.render('wakildekan/dashboard', {
            stats: statsRows[0],
            recentSubmitted: submittedRows,
            recentDecisions: decisionRows,
            title: 'Dashboard Wakil Dekan'
        });
    } catch (error) {
        console.error('dashboard error:', error);
        res.status(500).render('wakildekan/error', {
            title: 'Terjadi Kesalahan',
            message: 'Gagal memuat dashboard. Silakan coba lagi nanti.',
            backUrl: '/wakildekan/permohonan'
        });
    }
};

module.exports = {
    listPermohonan,
    detailPermohonan,
    approvePermohonan,
    rejectPermohonan,
    riwayatPermohonan,
    downloadPDF,
    getPermohonanAPI,
    dashboard
};
