// Promueve un usuario YA REGISTRADO (se registra en /login) usando el rol dueño de la base.
// Es el único camino fuera de RLS. Uso:
//   node scripts/promote-user.mjs <email> --platform-admin
//   node scripts/promote-user.mjs <email> --member <slug-agencia> [--role agent|agency_admin]
// Usa DATABASE_URL de .env.local (Supabase) o del entorno. Pide --yes para aplicar; sin eso solo muestra qué haría.
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import postgres from "postgres";

if (existsSync(".env.local")) Object.assign(process.env, parseEnv(readFileSync(".env.local", "utf8")));
const args = process.argv.slice(2);
const email = args[0]?.toLowerCase();
const flag = (n) => args.includes(n);
const val = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const die = (m) => { console.error(m); process.exit(1); };

if (!email || !email.includes("@")) die("Uso: promote-user.mjs <email> --platform-admin | --member <slug> [--role agent|agency_admin] [--yes]");
if (!process.env.DATABASE_URL) die("Falta DATABASE_URL");
const host = new URL(process.env.DATABASE_URL).hostname;
const sql = postgres(process.env.DATABASE_URL, { onnotice: () => {}, max: 1 });

try {
  const [user] = await sql`select id, email from user_profile where lower(email) = ${email}`;
  if (!user) die(`No existe un perfil con ${email}. Primero debe registrarse en /login.`);
  const apply = flag("--yes");
  console.log(`Base: ${host}${apply ? "" : "  (simulación; agregá --yes para aplicar)"}`);

  if (flag("--platform-admin")) {
    console.log(`-> ${email} pasa a platform_admin`);
    if (apply) await sql`update user_profile set platform_role = 'platform_admin' where id = ${user.id}`;
  } else if (val("--member")) {
    const slug = val("--member");
    const role = val("--role") ?? "agent";
    if (!["agent", "agency_admin"].includes(role)) die("--role debe ser agent o agency_admin");
    const [ag] = await sql`select id, name, status from agency where slug = ${slug}`;
    if (!ag) die(`No existe la agencia "${slug}"`);
    console.log(`-> ${email} pasa a ${role} activo de "${ag.name}" (agencia ${ag.status})`);
    if (apply)
      await sql`insert into agency_member (agency_id, user_id, role, status, display_name)
        values (${ag.id}, ${user.id}, ${role}, 'active', ${email.split("@")[0]})
        on conflict (agency_id, user_id) do update set role = excluded.role, status = 'active'`;
  } else die("Indicá --platform-admin o --member <slug>");
  console.log(apply ? "Listo." : "Nada cambió.");
} finally {
  await sql.end();
}
