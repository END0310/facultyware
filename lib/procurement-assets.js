async function autoRegisterAssetsFromProcurement(conn, procurementId) {
  const [existingAssets] = await conn.query(`
    SELECT COUNT(*) AS total
    FROM assets
    WHERE acquisition_type = 'procurement'
      AND asset_grant_id = ?
  `, [procurementId]);

  if (Number(existingAssets[0]?.total || 0) > 0) {
    return { createdCount: 0, skipped: true };
  }

  const [items] = await conn.query(`
    SELECT id, name, specification, quantity, estimated_price
    FROM equipment_proc_items
    WHERE equipment_proc_id = ?
    ORDER BY id ASC
  `, [procurementId]);

  let createdCount = 0;

  for (const item of items) {
    const quantity = Math.max(Number(item.quantity || 0), 1);
    for (let index = 1; index <= quantity; index += 1) {
      const assetCode = `AST-PR-${procurementId}-${item.id}-${String(index).padStart(2, '0')}`;
      const assetName = quantity > 1 ? `${item.name} #${index}` : item.name;

      const [assetResult] = await conn.query(
        "INSERT INTO assets (name, code, type, acquisition_type, acquisition_date, acquisition_cost, asset_grant_id, `condition`, status, created_at, updated_at) VALUES (?, ?, 'equipment', 'procurement', CURDATE(), ?, ?, 'good', 'available', NOW(), NOW())",
        [assetName, assetCode, Number(item.estimated_price || 0), procurementId]
      );

      await conn.query(`
        INSERT INTO equipments
        (asset_id, brand, model, serial_number, specification, purchase_link, photo, depreciation_value, useful_life, created_at, updated_at)
        VALUES (?, NULL, NULL, NULL, ?, NULL, NULL, NULL, NULL, NOW(), NOW())
      `, [assetResult.insertId, item.specification || null]);

      createdCount += 1;
    }
  }

  return { createdCount, skipped: false };
}

async function applyProcurementDecision(conn, procurementId, decision) {
  const [result] = await conn.query(`
    UPDATE equipment_procurements
    SET status = ?, updated_at = NOW()
    WHERE id = ? AND status = 'submitted'
  `, [decision, procurementId]);

  if (!result.affectedRows) {
    return { updated: false, assetSummary: { createdCount: 0, skipped: false } };
  }

  let assetSummary = { createdCount: 0, skipped: false };
  if (decision === 'approved') {
    assetSummary = await autoRegisterAssetsFromProcurement(conn, procurementId);
  }

  return { updated: true, assetSummary };
}

module.exports = {
  applyProcurementDecision
};
