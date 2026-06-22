USE `facultyware`;

-- Seed ini hanya INSERT/UPDATE data awal. Tidak membuat/mengubah struktur tabel.
SET @PASSWORD_HASH = '$2b$10$TEUAHN7ky2dkCUF9WCMs.elFsyYXnkJKLdbjkG2XxWglZtt0a5JHW'; -- password123

INSERT INTO organization_units (id, name, code, parent_id, type, description, organization_unit_id, created_at, updated_at)
VALUES (9001, 'Fakultas Teknologi Informasi', 'FTI-SEED', NULL, 'faculty', 'Seed unit untuk testing Pengadaan Barang', 9001, NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), updated_at = NOW();

INSERT INTO employment_statuses (id, name, description, created_at, updated_at)
VALUES (9001, 'Aktif', 'Seed status untuk testing', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), updated_at = NOW();

INSERT INTO users (id, name, email, email_verified_at, password, created_at, updated_at) VALUES
(9001, 'Ketua Departemen', 'ketua.departemen@facultyware.test', NOW(), @PASSWORD_HASH, NOW(), NOW()),
(9002, 'Pengelola Aset', 'pengelola.aset@facultyware.test', NOW(), @PASSWORD_HASH, NOW(), NOW()),
(9003, 'Wakil Dekan', 'wakil.dekan@facultyware.test', NOW(), @PASSWORD_HASH, NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email), password = VALUES(password), updated_at = NOW();

INSERT INTO employees (id, employee_number, national_id_number, tax_id_number, name, birth_place, birth_date, gender, religion, marital_status, address, phone_number, organization_unit_id, hire_date, employment_status_id, status, created_at, updated_at) VALUES
(9001, 'EMP-PROC-001', NULL, NULL, 'Ketua Departemen', 'Padang', '1985-01-01', 'male', NULL, 'married', 'Kampus UNAND', '080000000001', 9001, '2020-01-01', 9001, 'active', NOW(), NOW()),
(9002, 'EMP-PROC-002', NULL, NULL, 'Pengelola Aset', 'Padang', '1985-01-01', 'male', NULL, 'married', 'Kampus UNAND', '080000000002', 9001, '2020-01-01', 9001, 'active', NOW(), NOW()),
(9003, 'EMP-PROC-003', NULL, NULL, 'Wakil Dekan', 'Padang', '1985-01-01', 'male', NULL, 'married', 'Kampus UNAND', '080000000003', 9001, '2020-01-01', 9001, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), employee_number = VALUES(employee_number), updated_at = NOW();

INSERT INTO roles (id, name, guard_name, created_at, updated_at) VALUES
(9001, 'Ketua Departemen', 'web', NOW(), NOW()),
(9002, 'Pengelola Aset', 'web', NOW(), NOW()),
(9003, 'Wakil Dekan', 'web', NOW(), NOW()),
(9005, 'Pengelola Sistem', 'web', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), guard_name = VALUES(guard_name), updated_at = NOW();

INSERT INTO permissions (id, name, guard_name, created_at, updated_at) VALUES
(9001, 'procurement.request.read', 'web', NOW(), NOW()),
(9002, 'procurement.request.update_status', 'web', NOW(), NOW()),
(9003, 'procurement.create', 'web', NOW(), NOW()),
(9004, 'procurement.read', 'web', NOW(), NOW()),
(9005, 'procurement.submit', 'web', NOW(), NOW()),
(9006, 'procurement.decision', 'web', NOW(), NOW()),
(9007, 'procurement.asset.create', 'web', NOW(), NOW()),
(9008, 'procurement.report', 'web', NOW(), NOW()),
(9009, 'procurement.api.read', 'web', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), guard_name = VALUES(guard_name), updated_at = NOW();

INSERT IGNORE INTO model_has_roles (role_id, model_type, model_id) VALUES
(9001, 'App\\Models\\User', 9001),
(9002, 'App\\Models\\User', 9002),
(9003, 'App\\Models\\User', 9003);

INSERT IGNORE INTO role_has_permissions (permission_id, role_id) VALUES
(9001, 9002), (9002, 9002), (9003, 9002), (9004, 9002), (9005, 9002), (9007, 9002), (9008, 9002), (9009, 9002),
(9001, 9005), (9002, 9005), (9003, 9005), (9004, 9005), (9005, 9005), (9007, 9005), (9008, 9005), (9009, 9005),
(9004, 9003), (9006, 9003), (9008, 9003), (9009, 9003);

INSERT INTO equipment_requests (id, request_number, employee_id, name, specification, purchase_link, photo, quantity, status, submitted_at, approved_by, approved_at, created_at, updated_at) VALUES
(9001, 'ER-SEED-001', 9001, 'Laptop Laboratorium', 'Core i5/Ryzen 5, RAM 16 GB, SSD 512 GB', NULL, NULL, 5, 'pending', NOW(), NULL, NULL, NOW(), NOW()),
(9002, 'ER-SEED-002', 9001, 'Proyektor Kelas', 'Minimal Full HD, HDMI, brightness 3500 lumens', NULL, NULL, 2, 'approved', NOW(), 9002, NOW(), NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), status = VALUES(status), updated_at = NOW();

INSERT INTO equipment_procurements (id, request_number, title, status, created_by, employee_id, created_at, updated_at) VALUES
(9001, 'PR-SEED-001', 'Draft Pengadaan Laptop Laboratorium', 'draft', 9002, 9002, NOW(), NOW()),
(9002, 'PR-SEED-002', 'Permohonan Pengadaan Proyektor Kelas', 'submitted', 9002, 9002, NOW(), NOW()),
(9003, 'PR-SEED-003', 'Permohonan Pengadaan Printer Administrasi', 'approved', 9002, 9002, NOW(), NOW()),
(9004, 'PR-SEED-004', 'Pengadaan Scanner Arsip Completed', 'completed', 9002, 9002, NOW(), NOW())
ON DUPLICATE KEY UPDATE title = VALUES(title), status = VALUES(status), updated_at = NOW();

INSERT INTO equipment_proc_items (id, equipment_proc_id, name, specification, quantity, estimated_price, asset_equipment_procurement_id, created_at, updated_at) VALUES
(9001, 9001, 'Laptop Laboratorium', 'Core i5/Ryzen 5, RAM 16 GB, SSD 512 GB', 5, 8500000.00, 9001, NOW(), NOW()),
(9002, 9002, 'Proyektor Kelas', 'Full HD, HDMI, brightness 3500 lumens', 2, 6500000.00, 9002, NOW(), NOW()),
(9003, 9003, 'Printer Administrasi', 'Laser printer network duplex', 1, 4200000.00, 9003, NOW(), NOW()),
(9004, 9004, 'Scanner Arsip', 'ADF scanner 40 ppm', 1, 3800000.00, 9004, NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), quantity = VALUES(quantity), estimated_price = VALUES(estimated_price), updated_at = NOW();

INSERT INTO assets (id, name, code, type, acquisition_type, acquisition_date, acquisition_cost, asset_grant_id, `condition`, status, created_at, updated_at)
VALUES (9001, 'Scanner Arsip', 'AST-SEED-001', 'equipment', 'procurement', CURDATE(), 3800000.00, NULL, 'good', 'available', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), updated_at = NOW();

INSERT INTO equipments (id, asset_id, brand, model, serial_number, specification, purchase_link, photo, depreciation_value, useful_life, created_at, updated_at)
VALUES (9001, 9001, 'Canon', 'DR-C225', 'SN-SEED-001', 'ADF scanner 40 ppm', NULL, NULL, NULL, NULL, NOW(), NOW())
ON DUPLICATE KEY UPDATE brand = VALUES(brand), model = VALUES(model), updated_at = NOW();
