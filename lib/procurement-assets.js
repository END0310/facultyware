async function applyProcurementDecision(conn, procurementId, decision) {
  const [result] = await conn.query(`
    UPDATE equipment_procurements
    SET status = ?, updated_at = NOW()
    WHERE id = ? AND status = 'submitted'
  `, [decision, procurementId]);

  if (!result.affectedRows) {
    return { updated: false, assetSummary: { createdCount: 0, skipped: false } };
  }

  return { updated: true, assetSummary: { createdCount: 0, skipped: true } };
}

module.exports = {
  applyProcurementDecision
};
