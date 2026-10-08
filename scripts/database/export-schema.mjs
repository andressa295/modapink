#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export function runProgram(program, args, env = process.env) {
  return new Promise((resolvePromise, reject) => {
    // Credenciais somente no ambiente libpq; nunca na linha de comando.
    const child = spawn(program, args, { env, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = [];
    child.stdout.on('data', chunk => stdout.push(chunk));
    child.stderr.on('data', () => {}); // Mensagens externas podem conter a conexao.
    child.on('error', () => reject(new Error(`Nao foi possivel executar ${program}. Verifique a instalacao.`)));
    child.on('close', code => code === 0
      ? resolvePromise(Buffer.concat(stdout).toString('utf8'))
      : reject(new Error(`${program} falhou (codigo ${code}). Nenhuma captura foi marcada como completa.`)));
  });
}

export async function exportSchema({ env = process.env, run = runProgram, outputDir } = {}) {
  if (!env.PGHOST || !env.PGUSER || !env.PGDATABASE) {
    throw new Error('Configure PGHOST, PGPORT, PGUSER, PGDATABASE e a autenticacao libpq (PGPASSWORD ou .pgpass).');
  }
  const safeEnv = {
    ...env,
    PGSSLMODE: env.PGSSLMODE || 'require',
    PGCONNECT_TIMEOUT: env.PGCONNECT_TIMEOUT || '15',
    PGOPTIONS: `${env.PGOPTIONS || ''} -c default_transaction_read_only=on`,
  };
  const catalogText = await run('psql', [
    '-X', '-q', '-A', '-t', '--set', 'ON_ERROR_STOP=1',
    '--file', resolve(root, 'database/replication/catalog.sql'),
  ], safeEnv);
  let catalog;
  try { catalog = JSON.parse(catalogText.trim()); }
  catch { throw new Error('O catalogo nao retornou um JSON valido. A captura foi interrompida.'); }
  if (!Array.isArray(catalog.application_schemas) || !catalog.application_schemas.length) {
    throw new Error('Nenhum schema de aplicacao foi identificado.');
  }
  if (catalog.application_schemas.some(name => typeof name !== 'string' || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name))) {
    throw new Error('Nome de schema exige revisao manual antes do pg_dump.');
  }
  const dump = await run('pg_dump', [
    '--schema-only', '--no-owner', '--quote-all-identifiers', '--strict-names',
    '--no-publications', '--no-subscriptions',
    ...catalog.application_schemas.map(name => `--schema=${name}`),
  ], safeEnv);
  if (!dump.includes('PostgreSQL database dump')) throw new Error('O pg_dump nao retornou um dump reconhecido.');
  // O schema public ja existe num projeto Supabase novo. Nenhum DROP e acrescentado.
  const baseline = dump.replace(/^CREATE SCHEMA ("[^"]+");$/gm, 'CREATE SCHEMA IF NOT EXISTS $1;');
  const directory = outputDir || resolve(root, 'database/replication/captures', new Date().toISOString().replace(/[:.]/g, '-'));
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(resolve(directory, 'catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  await writeFile(resolve(directory, 'schema.raw.sql'), dump, { flag: 'wx', mode: 0o600 });
  await writeFile(resolve(directory, 'schema.sql'), baseline, { flag: 'wx', mode: 0o600 });
  const managed = {
    status: 'review_required',
    triggers: (catalog.triggers || []).filter(item => ['auth', 'storage', 'realtime'].includes(item.schema)),
    policies: (catalog.policies || []).filter(item => ['auth', 'storage', 'realtime'].includes(item.schemaname)),
    publications: catalog.publications || [],
    extensions: catalog.extensions || [],
    note: 'Este arquivo e inventario, nao SQL aplicavel. Compare schemas gerenciados com um projeto Supabase novo.',
  };
  await writeFile(resolve(directory, 'managed-review.json'), `${JSON.stringify(managed, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  await writeFile(resolve(directory, 'capture-status.json'), `${JSON.stringify({
    status: 'captured_not_restore_verified',
    captured_at: catalog.captured_at,
    source_project_ref: env.PHAND_SOURCE_PROJECT_REF || null,
    catalog_and_dump_are_separate_read_only_snapshots: true,
    warning: 'Nao alterar o esquema durante a captura. Revisar segredos em funcoes e validar restauracao num banco vazio antes de versionar.',
  }, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  return directory;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  exportSchema().then(directory => console.log(`Estrutura capturada em ${directory}. Restauracao e revisao ainda pendentes.`))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
