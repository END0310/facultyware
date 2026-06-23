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
