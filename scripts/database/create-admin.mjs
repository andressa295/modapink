#!/usr/bin/env node
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Esta ferramenta inicializa SOMENTE uma instalacao nova.
const protectedSourceProject = 'wpzqnfvuczqnpuvuxdlx';

export function readConfig(env = process.env) {
  const required = [
    'PHAND_TARGET_SUPABASE_URL', 'PHAND_TARGET_SUPABASE_SERVICE_ROLE_KEY',
    'PHAND_EXPECTED_PROJECT_REF', 'PHAND_ADMIN_EMAIL', 'PHAND_ADMIN_NAME', 'PHAND_ADMIN_PASSWORD',
  ];
  for (const name of required) if (!env[name]?.trim()) throw new Error(`Configure ${name}.`);
  let url;
  try { url = new URL(env.PHAND_TARGET_SUPABASE_URL); }
  catch { throw new Error('URL Supabase invalida.'); }
  const projectRef = url.hostname.split('.')[0];
  if (url.protocol !== 'https:' || !/^[a-z]{20}\.supabase\.co$/.test(url.hostname)
    || url.username || url.password || url.port || url.search || url.hash || !['', '/'].includes(url.pathname)) {
    throw new Error('Use a URL HTTPS padrao do projeto Supabase novo.');
  }
  if (projectRef !== env.PHAND_EXPECTED_PROJECT_REF) throw new Error('O projeto de destino difere de PHAND_EXPECTED_PROJECT_REF.');
  if (projectRef === protectedSourceProject || projectRef === env.PHAND_SOURCE_PROJECT_REF) {
    throw new Error('O projeto de origem/Moda Pink nao pode receber o bootstrap.');
  }
  const email = env.PHAND_ADMIN_EMAIL.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('E-mail do administrador invalido.');
  const password = env.PHAND_ADMIN_PASSWORD;
  if (password.length < 12) throw new Error('Defina uma senha com pelo menos 12 caracteres.');
  return { origin: url.origin, projectRef, key: env.PHAND_TARGET_SUPABASE_SERVICE_ROLE_KEY,
    email, name: env.PHAND_ADMIN_NAME.trim(), password };
}

export async function createAdmin({ env = process.env, apply = false, fetchImpl = globalThis.fetch } = {}) {
  const config = readConfig(env);
  if (!apply) return { status: 'dry_run', projectRef: config.projectRef };

  async function request(path, { method = 'GET', body, prefer } = {}) {
    let response;
    try {
      response = await fetchImpl(`${config.origin}${path}`, {
        method, headers: {
          apikey: config.key, Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json',
          ...(prefer ? { Prefer: prefer } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(15_000),
      });
    } catch { throw new Error(`Falha de conexao em ${method} ${path.split('?')[0]}. O resultado remoto pode ser incerto; confira antes de repetir.`); }
    if (!response.ok) throw new Error(`Supabase recusou ${method} ${path.split('?')[0]} (HTTP ${response.status}).`);
    if (response.status === 204) return null;
    try { return await response.json(); }
    catch { throw new Error(`Resposta invalida em ${method} ${path.split('?')[0]}. Confira o estado remoto.`); }
  }

  // Exige estrutura criada e ausencia de contas/perfis antes de qualquer escrita.
  const profiles = await request('/rest/v1/profiles?select=id&limit=1');
  if (!Array.isArray(profiles) || profiles.length) throw new Error('O destino ja tem perfis ou nao possui a estrutura esperada.');
  const accounts = await request('/auth/v1/admin/users?page=1&per_page=1');
  if (!Array.isArray(accounts?.users) || accounts.users.length) throw new Error('O destino ja tem contas no Auth. Bootstrap interrompido.');

  const created = await request('/auth/v1/admin/users', {
    method: 'POST', body: {
      email: config.email, password: config.password, email_confirm: true,
      user_metadata: { name: config.name, role: 'admin' },
    },
  });
  const userId = created?.user?.id || created?.id;
  if (typeof userId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    throw new Error('O Auth nao retornou um ID valido. Confira a conta no projeto antes de repetir.');
  }

  try {
    // Upsert cobre o caso em que um trigger do Auth ja criou o perfil.
    const result = await request('/rest/v1/profiles?on_conflict=id', {
      method: 'POST', prefer: 'resolution=merge-duplicates,return=representation',
      body: { id: userId, name: config.name, email: config.email, role: 'admin' },
    });
    if (!Array.isArray(result) || !result.some(row => row.id === userId && row.role === 'admin')) {
      throw new Error('O perfil administrador nao foi confirmado.');
    }
    return { status: 'created', projectRef: config.projectRef, userId };
  } catch {
    // A conta pertence a esta tentativa; FK profiles -> auth.users usa ON DELETE CASCADE.
    // Remove o perfil explicitamente caso o esquema real ainda nao tenha essa FK.
    let profileCleaned = true;
    try { await request(`/rest/v1/profiles?id=eq.${userId}`, { method: 'DELETE', prefer: 'return=minimal' }); }
    catch { profileCleaned = false; }
    try { await request(`/auth/v1/admin/users/${userId}`, { method: 'DELETE' }); }
    catch { throw new Error(`Falha ao criar perfil e remover a conta ${userId}. Conclua a limpeza desse ID no projeto de destino.`); }
    if (!profileCleaned) throw new Error(`Conta ${userId} removida; confira se o perfil foi excluido por cascata.`);
    throw new Error('Falha ao criar perfil. A conta desta tentativa foi removida.');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--apply') || args.length > 1) {
    console.error('Uso: node scripts/database/create-admin.mjs [--apply]');
    process.exitCode = 1;
  } else {
    createAdmin({ apply: args.includes('--apply') })
      .then(result => console.log(result.status === 'dry_run'
        ? `Configuracao validada para ${result.projectRef}. Use --apply para criar o primeiro administrador.`
        : `Administrador criado e perfil confirmado no projeto ${result.projectRef}.`))
      .catch(error => { console.error(error.message); process.exitCode = 1; });
  }
}
