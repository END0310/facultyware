const db = require('../lib/db');
const PDFDocument = require('pdfkit');
const { applyProcurementDecision } = require('../lib/procurement-assets');

const listPermohonan = async (req, res) => {
    try {
        const query = `
            SELECT ep.id, ep.request_number, ep.title, ep.status, e.name AS created_by_name, ep.created_at 
            FROM equipment_procurements ep 
            JOIN employees e ON ep.created_by = e.id 
            WHERE ep.status = 'submitted' 
            ORDER BY ep.created_at DESC
        `;
        const [rows] = await db.query(query);
        res.render('wakildekan/index', { 
            permohonan: rows, 
            title: 'Daftar Permohonan Pengadaan' 
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
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
            title: 'Detail Permohonan'
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
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
        console.error(error);
        res.status(500).send('Server error');
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
        console.error(error);
        res.status(500).send('Server error');
    } finally {
        conn.release();
    }
};

const riwayatPermohonan = async (req, res) => {
    try {
        const query = `
            SELECT ep.id, ep.request_number, ep.title, ep.status, e.name AS created_by_name, ep.created_at 
            FROM equipment_procurements ep 
            JOIN employees e ON ep.created_by = e.id 
            WHERE ep.status IN ('approved', 'rejected')
            ORDER BY ep.created_at DESC
        `;
        const [rows] = await db.query(query);
        res.render('wakildekan/riwayat', { 
            permohonan: rows, 
            title: 'Riwayat Keputusan' 
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
};

const downloadPDF = async (req, res) => {
    try {
        const query = `
            SELECT ep.id, ep.request_number, ep.title, ep.status, e.name AS created_by_name, ep.created_at 
            FROM equipment_procurements ep 
            JOIN employees e ON ep.created_by = e.id 
            WHERE ep.status IN ('approved', 'rejected')
            ORDER BY ep.created_at DESC
        `;
        const [rows] = await db.query(query);

        const doc = new PDFDocument({ margin: 30, size: 'A4' });
        
        res.setHeader('Content-disposition', 'attachment; filename="laporan-pengadaan-wakildekan.pdf"');
        res.setHeader('Content-type', 'application/pdf');
        
        doc.pipe(res);

        doc.fontSize(14).font('Helvetica-Bold').text('LAPORAN REKAPAN KEPUTUSAN PENGADAAN BARANG - WAKIL DEKAN', { align: 'center' });
        doc.moveDown(2);

        const tableTop = 100;
        const col1 = 30;
        const col2 = 60;
        const col3 = 180;
        const col4 = 360;
        const col5 = 450;
        const col6 = 520;

        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('No', col1, tableTop);
        doc.text('Nomor Request', col2, tableTop);
        doc.text('Judul Pengadaan', col3, tableTop);
        doc.text('Diajukan Oleh', col4, tableTop);
        doc.text('Tanggal', col5, tableTop);
        doc.text('Status', col6, tableTop);
        
        doc.moveTo(30, tableTop + 15).lineTo(565, tableTop + 15).stroke();

        let y = tableTop + 25;
        doc.font('Helvetica');
        
        rows.forEach((row, i) => {
            if (y > 750) {
                doc.addPage();
                y = 50;
            }
            
            const reqNum = row.request_number || '-';
            const title = row.title || '-';
            const name = row.created_by_name || '-';
            const date = new Date(row.created_at).toLocaleDateString('id-ID');
            let status = row.status === 'approved' ? 'Disetujui' : (row.status === 'rejected' ? 'Ditolak' : row.status);

            doc.text(i + 1, col1, y);
            doc.text(reqNum, col2, y);
            doc.text(title.substring(0, 30), col3, y);
            doc.text(name.substring(0, 15), col4, y);
            doc.text(date, col5, y);
            doc.text(status, col6, y);
            
            y += 20;
            doc.moveTo(30, y - 5).lineTo(565, y - 5).lineWidth(0.5).stroke();
        });

        doc.end();
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
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

module.exports = {
    listPermohonan,
    detailPermohonan,
    approvePermohonan,
    rejectPermohonan,
    riwayatPermohonan,
    downloadPDF,
    getPermohonanAPI
};
