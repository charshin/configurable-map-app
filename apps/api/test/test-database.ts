/**
 * The e2e tests use their own database (`<name>_test`) on the same server as
 * DATABASE_URL, so running them never touches development data.
 */
export function testDatabaseUrl(): string {
  try {
    process.loadEnvFile();
  } catch {
    // no .env file
  }
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error('DATABASE_URL is not set (see apps/api/.env.example)');
  const url = new URL(base);
  const name = url.pathname.slice(1) || 'postgres';
  url.pathname = `/${name.endsWith('_test') ? name : `${name}_test`}`;
  return url.toString();
}
