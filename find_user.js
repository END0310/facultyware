const db = require('./lib/db');

async function findAllUsers() {
    try {
        const query = `
            SELECT u.email, u.password, r.name as role_name
            FROM users u 
            JOIN model_has_roles mhr ON u.id = mhr.model_id 
            JOIN roles r ON mhr.role_id = r.id 
        `;
        const [rows] = await db.query(query);
        console.log("Users and roles:");
        rows.forEach(r => console.log(r));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

findAllUsers();
