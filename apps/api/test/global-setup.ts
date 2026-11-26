import { execSync } from 'node:child_process';
import { testDatabaseUrl } from './test-database.js';

/**
 * Brings the test database up to date once per e2e run, without destroying
 * anything: `migrate deploy` creates the database if needed and applies any
 * pending migrations, and the seed is idempotent. Each test file removes the
 * rows it creates.
 */
export default function setup() {
  const env = { ...process.env, DATABASE_URL: testDatabaseUrl() };
  execSync('prisma migrate deploy', { env, stdio: 'inherit' });
  execSync('prisma db seed', { env, stdio: 'inherit' });
}
