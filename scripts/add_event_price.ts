import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function main() {
  await db.execute(sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS price integer`);
  console.log('price column added to events table');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
