const db = require('../lib/db');
const bcrypt = require('bcryptjs');

async function run() {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    console.log("Seeding database...");

    // 1. Clear existing data in correct order
    await connection.query("DELETE FROM model_has_roles");
    await connection.query("DELETE FROM role_has_permissions");
    await connection.query("DELETE FROM roles");
    await connection.query("DELETE FROM permissions");
    await connection.query("DELETE FROM equipment_proc_items");
    await connection.query("DELETE FROM equipment_procurements");
    await connection.query("DELETE FROM employees");
    await connection.query("DELETE FROM users");
    await connection.query("DELETE FROM employment_statuses");
    await connection.query("DELETE FROM organization_units");

    // 2. Insert organization unit
    await connection.query(`
      INSERT INTO organization_units 
        (id, name, code, parent_id, type, description, organization_unit_id, created_at, updated_at)
      VALUES 
        (1, 'Departemen Teknologi Informasi', 'DTI', NULL, 'department', 'Departemen TI', 1, NOW(), NOW())
    `);

    // 3. Insert employment status
    await connection.query(`
      INSERT INTO employment_statuses
        (id, name, description, created_at, updated_at)
      VALUES
        (1, 'PNS Dosen', 'Pegawai Negeri Sipil Dosen', NOW(), NOW())
    `);

    // 4. Create Roles
    await connection.query(`
      INSERT INTO roles (id, name, guard_name, created_at, updated_at)
      VALUES 
        (1, 'ketua_departemen', 'web', NOW(), NOW()),
        (2, 'wakildekan', 'web', NOW(), NOW())
    `);

    // 5. Create Permissions
    await connection.query(`
      INSERT INTO permissions (id, name, guard_name, created_at, updated_at)
      VALUES
        (1, 'create_procurements', 'web', NOW(), NOW()),
        (2, 'approve_procurements', 'web', NOW(), NOW())
    `);

    // 6. Map Roles to Permissions
    await connection.query(`
      INSERT INTO role_has_permissions (permission_id, role_id)
      VALUES
        (1, 1), -- ketua_departemen has create_procurements
        (2, 2)  -- wakildekan has approve_procurements
    `);

    const hashedPassword = await bcrypt.hash('password', 10);

    // 7. Insert Diva (Ketua Departemen)
    await connection.query(`
      INSERT INTO users (id, name, email, password, created_at, updated_at)
      VALUES (1, 'Diva', 'diva@facultyware.id', ?, NOW(), NOW())
    `, [hashedPassword]);

    await connection.query(`
      INSERT INTO employees 
        (id, employee_number, name, birth_place, birth_date, gender, religion, marital_status, address, phone_number, organization_unit_id, hire_date, employment_status_id, status, created_at, updated_at)
      VALUES
        (1, '19901010101010', 'Diva', 'Padang', '1990-10-10', 'female', 'Islam', 'married', 'Jl. Kampus Unand', '08123456789', 1, '2015-03-01', 1, 'active', NOW(), NOW())
    `);

    await connection.query(`
      INSERT INTO model_has_roles (role_id, model_type, model_id)
      VALUES (1, 'User', 1)
    `);

    // 8. Insert Aldo (Wakil Dekan)
    await connection.query(`
      INSERT INTO users (id, name, email, password, created_at, updated_at)
      VALUES (2, 'Aldo Septia Elvawan', 'aldo@facultyware.id', ?, NOW(), NOW())
    `, [hashedPassword]);

    await connection.query(`
      INSERT INTO employees 
        (id, employee_number, name, birth_place, birth_date, gender, religion, marital_status, address, phone_number, organization_unit_id, hire_date, employment_status_id, status, created_at, updated_at)
      VALUES
        (2, '19850505101020', 'Aldo Septia Elvawan', 'Padang', '1985-05-05', 'male', 'Islam', 'married', 'Jl. Dekanat Lantai 2', '08987654321', 1, '2010-08-01', 1, 'active', NOW(), NOW())
    `);

    await connection.query(`
      INSERT INTO model_has_roles (role_id, model_type, model_id)
      VALUES (2, 'User', 2)
    `);

    // 9. Create some sample procurements (from Diva)
    // Proc 1: Diajukan (submitted)
    await connection.query(`
      INSERT INTO equipment_procurements (id, request_number, title, status, created_by, employee_id, created_at, updated_at)
      VALUES (1, 'REQ-2026-00001', 'Pengadaan Laptop Laboratorium Pemrograman', 'submitted', 1, 1, NOW(), NOW())
    `);
    await connection.query(`
      INSERT INTO equipment_proc_items (equipment_proc_id, name, specification, quantity, estimated_price, asset_equipment_procurement_id, created_at, updated_at)
      VALUES 
        (1, 'Laptop ASUS ROG', 'Intel i7, 16GB RAM, 512GB SSD', 5, 15000000.00, 1, NOW(), NOW()),
        (1, 'Mouse Logitech Wireless', 'B170 silent', 5, 150000.00, 1, NOW(), NOW())
    `);

    // Proc 2: Draft
    await connection.query(`
      INSERT INTO equipment_procurements (id, request_number, title, status, created_by, employee_id, created_at, updated_at)
      VALUES (2, 'REQ-2026-00002', 'Pengadaan PC Server Jurusan', 'draft', 1, 1, NOW(), NOW())
    `);
    await connection.query(`
      INSERT INTO equipment_proc_items (equipment_proc_id, name, specification, quantity, estimated_price, asset_equipment_procurement_id, created_at, updated_at)
      VALUES 
        (2, 'Dell PowerEdge R750', 'Intel Xeon 32 Core, 64GB RAM, 2TB SSD', 1, 65000000.00, 2, NOW(), NOW())
    `);

    // Proc 3: Disetujui (approved)
    await connection.query(`
      INSERT INTO equipment_procurements (id, request_number, title, status, created_by, employee_id, created_at, updated_at)
      VALUES (3, 'REQ-2026-00003', 'Pengadaan Proyektor Ruang Kuliah', 'approved', 1, 1, NOW(), NOW())
    `);
    await connection.query(`
      INSERT INTO equipment_proc_items (equipment_proc_id, name, specification, quantity, estimated_price, asset_equipment_procurement_id, created_at, updated_at)
      VALUES 
        (3, 'Proyektor Epson EB-X500', '3600 Lumens, XGA', 2, 6000000.00, 3, NOW(), NOW())
    `);

    await connection.commit();
    console.log("Database seeded successfully!");
    process.exit(0);
  } catch (err) {
    await connection.rollback();
    console.error("Error seeding database:", err);
    process.exit(1);
  } finally {
    connection.release();
  }
}
run();
