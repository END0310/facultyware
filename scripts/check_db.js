const db = require('../lib/db');

async function run() {
  const tables = [
    'users', 'employees', 'employment_statuses', 'organization_units',
    'roles', 'permissions', 'model_has_roles', 'role_has_permissions',
    'equipment_procurements', 'equipment_proc_items'
  ];
  
  for (const table of tables) {
    try {
      const [desc] = await db.query(`DESCRIBE \`${table}\``);
      console.log(`Table ${table} description:`);
      console.log(desc.map(d => `${d.Field} (${d.Type}) - Null: ${d.Null} - Key: ${d.Key}`).join('\n'));
      console.log('------------------------------');
    } catch (err) {
      console.error(`Error describing ${table}:`, err.message);
    }
  }
  process.exit(0);
}
run();
