import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

// Deliberately accepts NO connection string, project ref or remote database.
// Default: a freshly owned, portless/network-isolated Docker PG 17.6 container.
// Optional: an explicitly supplied local PGlite module (actual PostgreSQL WASM,
// not a JS SQL mock). This keeps QA-only dependencies out of the app/lockfile.
export async function disposablePostgres() {
  if (process.env.CARDIO_ZONE_PGLITE_MODULE) {
    const modulePath = process.env.CARDIO_ZONE_PGLITE_MODULE;
    if (/^[a-z]+:\/\//i.test(modulePath)) throw new Error('Only a local PGlite module path is accepted.');
    const { PGlite } = await import(pathToFileURL(modulePath).href);
    const pg = await PGlite.create();
    return {
      engine: 'PGlite / actual PostgreSQL WASM (Supabase-compatible SQL fixture)',
      exec: (sql) => pg.exec(sql),
      query: async (sql, context) => {
        if (!context) return (await pg.query(sql)).rows;
        if (context.role !== 'authenticated') throw new Error('Unsupported test role.');
        return pg.transaction(async (tx) => {
          await tx.exec(`set local role authenticated;
            select set_config('request.jwt.claim.sub', '${context.user.replaceAll("'", "''")}', true);`);
          return (await tx.query(sql)).rows;
        });
      },
      close: () => pg.close(),
    };
  }

  const name = `cardio-zone-foundation-${randomUUID()}`;
  const ownership = randomUUID();
  function docker(args, input) {
    const result = spawnSync('docker', args, {
      input, encoding: 'utf8', windowsHide: true, timeout: 60_000,
      maxBuffer: 8 * 1024 * 1024,
    });
    if (result.error || result.status !== 0) {
      const error = new Error(result.error?.message || result.stderr || 'Docker command failed.');
      error.code = result.stderr?.match(/ERROR:\s+([0-9A-Z]{5}):/)?.[1];
      throw error;
    }
    return result.stdout.trim();
  }
  let created = false;
  async function close() {
    if (!created) return;
    const label = docker(['inspect', '--format', '{{index .Config.Labels "vortixia.cardio-zone-test"}}', name]);
    if (label !== ownership) throw new Error('Refusing to remove a container not owned by this test.');
    docker(['rm', '--force', name]);
    created = false;
  }
  try {
    docker(['run', '--detach', '--name', name, '--network', 'none',
      '--label', `vortixia.cardio-zone-test=${ownership}`,
      '--env', `POSTGRES_PASSWORD=${randomUUID()}`, 'postgres:17.6']);
    created = true;
    for (let attempt = 0; attempt < 50; attempt++) {
      const ready = spawnSync('docker', ['exec', name, 'pg_isready', '-U', 'postgres'],
        { encoding: 'utf8', windowsHide: true, timeout: 5_000 });
      if (ready.status === 0) break;
      if (attempt === 49) throw new Error('Disposable PostgreSQL did not become ready.');
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    function exec(sql) {
      return docker(['exec', '-i', name, 'psql', '-X', '-q', '-A', '-t', '-U', 'postgres',
        '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose'], sql);
    }
    return {
      engine: 'Docker PostgreSQL 17.6 (Supabase-compatible SQL fixture)',
      exec,
      query: async (sql, context) => {
        if (context && context.role !== 'authenticated') throw new Error('Unsupported test role.');
        const prefix = context ? `begin; set local role authenticated; do $subject$ begin
          perform set_config('request.jwt.claim.sub', '${context.user.replaceAll("'", "''")}', true);
          end; $subject$;` : '';
        return JSON.parse(exec(`${prefix}select coalesce(jsonb_agg(to_jsonb(test_rows)), '[]'::jsonb)
          from (${sql.replace(/;\s*$/, '')}) as test_rows; ${context ? 'commit;' : ''}`));
      },
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}
