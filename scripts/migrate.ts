import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('[migrate] DATABASE_URL is not set. See .env.example.');
  process.exit(1);
}

const client = postgres(url, { max: 1 });
const db = drizzle(client);

async function main() {
  console.log('[migrate] Running migrations against', new URL(url!).host);
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('[migrate] Done.');
  await client.end();
}

main().catch((err) => {
  console.error('[migrate] Failed:', err);
  process.exit(1);
});
