// Member scope check (plan.md Section 3B; re-run at every checkpoint):
//
//   npm run db:check
//
// 1. Reads the live database: the restricted role is harmless, every table has
//    row-level security with exactly the member policy, and the role can reach
//    NOTHING without one (a grant without a policy would show a member everyone's rows).
// 2. Attacks it as each of two members, the way Pilot Light runs a member's
//    statements (the role + pilot_light.member_id, inside a transaction): own rows
//    only, in every table; stamping; forged ids; other members' rows; payments;
//    their own subscription and status; everything outside their tables.
//
// It changes nothing: every attack runs in a transaction that is rolled back.
// Exits 1 if anything fails. Runs outside Next.js, with its own connection.

import { config } from "dotenv";
import { Pool, neonConfig, type PoolClient } from "@neondatabase/serverless";
import ws from "ws";

config({ path: ".env.local", quiet: true });
const url = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error("No database URL: set DATABASE_URL (and DATABASE_URL_UNPOOLED) in .env.local (gate M1 in SETUP.md / plan.md).");
  process.exit(1);
}
neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: url });

const ROLE = "pilot_light_member";
const SETTING = "pilot_light.member_id";
/** The members table is scoped by its own id; every other table by member_id. */
const scopeColumn = (table: string) => (table === "members" ? "id" : "member_id");
/** What a member may only read (the site records payments from Stripe). */
const READ_ONLY = ["client_payments"];

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failed++;
  if (!ok || process.argv.includes("--verbose")) console.log(`  ${ok ? "✓" : "✗ FAILED"} ${name}${detail ? `  (${detail})` : ""}`);
  return ok;
};
const section = (title: string, before: number) => console.log(`${failed === before ? "✓" : "✗"} ${title}`);

/** Run something that should be refused; the transaction carries on afterwards. */
async function refused(c: PoolClient, text: string, values: unknown[] = []): Promise<string> {
  await c.query("savepoint attempt");
  try {
    await c.query(text, values);
    await c.query("release savepoint attempt");
    return "";
  } catch (e) {
    await c.query("rollback to savepoint attempt");
    return (e as Error).message;
  }
}

/** As Pilot Light runs a member's statements; always rolled back. */
async function asMember<T>(memberId: string | null, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query(`set local role ${ROLE}`);
    if (memberId) await c.query("select set_config($1, $2, true)", [SETTING, memberId]);
    return await fn(c);
  } finally {
    await c.query("rollback").catch(() => undefined);
    c.release();
  }
}

async function catalog(): Promise<string[]> {
  const before = failed;
  const [role] = (await pool.query("select oid, rolcanlogin, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb, rolreplication from pg_roles where rolname = $1", [ROLE])).rows;
  if (!check(`the role ${ROLE} exists`, Boolean(role))) return [];
  check("the role can't sign in, isn't a superuser, doesn't bypass row-level security, can't create roles or databases", !role.rolcanlogin && !role.rolsuper && !role.rolbypassrls && !role.rolcreaterole && !role.rolcreatedb && !role.rolreplication);
  const [{ n: memberships }] = (await pool.query("select count(*)::int as n from pg_auth_members where member = $1", [role.oid])).rows;
  check("the role belongs to no other role", memberships === 0, `${memberships} memberships`);
  const [can] = (await pool.query("select has_schema_privilege($1, 'public', 'CREATE') as create_public, has_database_privilege($1, current_database(), 'CREATE') as create_db", [ROLE])).rows;
  check("the role can't create anything in the database", !can.create_public && !can.create_db);

  // Every table in public: row-level security, the member policy and nothing wider, the stamp.
  const { rows: tables } = await pool.query<{ oid: number; name: string; rls: boolean; column_default: string | null }>(
    `select c.oid, c.relname as name, c.relrowsecurity as rls,
            (select pg_get_expr(d.adbin, d.adrelid) from pg_attribute a join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
              where a.attrelid = c.oid and a.attname = 'member_id') as column_default
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p') order by c.relname`,
  );
  for (const t of tables) {
    const col = scopeColumn(t.name);
    const { rows: policies } = await pool.query<{ name: string; cmd: string; roles: number[]; qual: string | null; with_check: string | null }>(
      "select polname as name, polcmd as cmd, polroles::oid[]::int[] as roles, pg_get_expr(polqual, polrelid) as qual, pg_get_expr(polwithcheck, polrelid) as with_check from pg_policy where polrelid = $1",
      [t.oid],
    );
    // Policies that bind the role: its own, and any written for everyone (role 0).
    const binding = policies.filter((p) => p.roles.includes(Number(role.oid)) || p.roles.includes(0));
    const shape = new RegExp(`^\\(${col} = \\(NULLIF\\(current_setting\\('${SETTING}'::text, true\\), ''::text\\)\\)::uuid\\)$`);
    const p = binding[0];
    check(`${t.name}: row-level security is on`, t.rls);
    check(`${t.name}: exactly one policy binds the role, and it is the member's own rows`, binding.length === 1 && p.name === "member_scope" && p.cmd === "*" && shape.test(p.qual ?? "") && shape.test(p.with_check ?? ""), binding.map((x) => `${x.name}: ${x.qual}`).join(" | ") || "no policy");
    if (t.name !== "members") check(`${t.name}: a new row is stamped with the member's id`, (t.column_default ?? "").includes(`current_setting('${SETTING}'`), t.column_default ?? "no default");
    const [g] = (await pool.query("select has_table_privilege($1, $2::oid, 'SELECT') as sel, has_table_privilege($1, $2::oid, 'INSERT') as ins, has_table_privilege($1, $2::oid, 'UPDATE') as upd, has_table_privilege($1, $2::oid, 'DELETE') as del, has_table_privilege($1, $2::oid, 'TRUNCATE') as trunc", [ROLE, t.oid])).rows;
    check(`${t.name}: the role can never TRUNCATE (that would skip row-level security)`, !g.trunc);
    if (READ_ONLY.includes(t.name) || t.name === "members") check(`${t.name}: the role can't insert, delete${t.name === "members" ? "" : " or update"} at the table level`, !g.ins && !g.del && !g.upd);
  }

  // Nothing else is reachable: any relation the role (or everyone) can touch must be a table with row-level security
  // and a policy that binds the role. A view or a bare grant would show a member every row.
  const { rows: reachable } = await pool.query<{ schema: string; name: string; kind: string; rls: boolean; policies: number }>(
    `select n.nspname as schema, c.relname as name, c.relkind as kind, c.relrowsecurity as rls,
            (select count(*)::int from pg_policy p where p.polrelid = c.oid and ($2::oid = any(p.polroles) or 0 = any(p.polroles))) as policies
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where c.relkind in ('r', 'p', 'v', 'm', 'f') and n.nspname not in ('pg_catalog', 'information_schema') and n.nspname not like 'pg_toast%'
        and has_schema_privilege($1, n.oid, 'USAGE')
        and (has_table_privilege($1, c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER') or has_any_column_privilege($1, c.oid, 'SELECT, INSERT, UPDATE, REFERENCES'))`,
    [ROLE, role.oid],
  );
  const open = reachable.filter((r) => !["r", "p"].includes(r.kind) || !r.rls || r.policies < 1);
  check("the role can reach nothing without row-level security and a policy", open.length === 0, open.map((r) => `${r.schema}.${r.name}`).join(", "));
  section(`the database's rules: the role, ${tables.length} tables, nothing reachable without a policy`, before);
  return tables.map((t) => t.name);
}

async function attack(tables: string[], me: { id: string; name: string }, other: { id: string; name: string }) {
  const before = failed;
  // What's really there, read as the database's own user.
  const truth = new Map<string, { mine: number; total: number }>();
  for (const t of tables) {
    const [r] = (await pool.query(`select count(*) filter (where ${scopeColumn(t)} = $1)::int as mine, count(*)::int as total from "${t}"`, [me.id])).rows;
    truth.set(t, r);
  }
  const [theirs] = (await pool.query("select c.id as client_id, p.id as property_id from clients c join properties p on p.client_id = c.id where c.member_id = $1 limit 1", [other.id])).rows;

  await asMember(me.id, async (c) => {
    for (const t of tables) {
      const [r] = (await c.query(`select count(*)::int as seen, count(*) filter (where ${scopeColumn(t)} <> $1)::int as others from "${t}"`, [me.id])).rows;
      const real = truth.get(t)!;
      check(`${me.name} · ${t}: sees their ${real.mine} of ${real.total} rows, none of anyone else's`, r.seen === real.mine && r.others === 0, `saw ${r.seen}, ${r.others} of others'`);
    }
    const [who] = (await c.query("select current_user as u, (select count(*)::int from members) as members")).rows;
    check(`${me.name}: runs as the restricted role and sees one member (themself)`, who.u === ROLE && who.members === 1);

    const [stamped] = (await c.query("insert into clients (name) values ('db:check') returning member_id")).rows;
    check(`${me.name}: a new row is stamped as theirs`, stamped.member_id === me.id);
    check(`${me.name}: can't add a row as another member`, /row-level security/.test(await refused(c, "insert into clients (member_id, name) values ($1, 'forged')", [other.id])));
    check(`${me.name}: can't hand their rows to another member`, /row-level security/.test(await refused(c, "update clients set member_id = $1", [other.id])));
    const upd = await c.query("update clients set name = 'hacked' where member_id = $1", [other.id]);
    const del = await c.query("delete from invoice_lines where member_id = $1", [other.id]);
    check(`${me.name}: changing or deleting another member's rows touches nothing`, upd.rowCount === 0 && del.rowCount === 0, `updated ${upd.rowCount}, deleted ${del.rowCount}`);
    if (theirs) {
      const fk = await refused(c, "insert into jobs (client_id, property_id) values ($1, $2)", [theirs.client_id, theirs.property_id]);
      check(`${me.name}: can't attach a job to another member's client (the database's own key)`, /jobs_member_(client|property)_fk/.test(fk), fk.slice(0, 90));
    }

    for (const sqlText of ["insert into client_payments (invoice_id, stripe_payment_intent, stripe_account_id, amount_cents) select id, 'pi_forged', 'acct_x', 1 from client_invoices limit 1", "update client_payments set status = 'refunded'", "delete from client_payments"]) {
      check(`${me.name}: can't ${sqlText.split(" ")[0]} payments`, /permission denied/.test(await refused(c, sqlText)));
    }

    const own = await c.query("update members set business_name = business_name");
    check(`${me.name}: can change their own business details`, own.rowCount === 1);
    for (const column of ["comped = true", "subscription_status = 'active'", "status = 'active'", "email = 'x@example.com'", "stripe_account_id = 'acct_x'", "payouts_enabled = true", "next_invoice_number = 1"]) {
      check(`${me.name}: can't set their own ${column.split(" ")[0]}`, /permission denied/.test(await refused(c, `update members set ${column}`)));
    }
    check(`${me.name}: can't add or remove a member`, /permission denied/.test(await refused(c, "insert into members (business_name, email) values ('x', 'x@example.com')")) && /permission denied/.test(await refused(c, "delete from members")));
    const otherMember = await c.query("update members set business_name = 'hacked' where id = $1", [other.id]);
    check(`${me.name}: can't change another member's details`, otherMember.rowCount === 0);

    for (const sqlText of ["truncate clients", "create table sneaky (id int)", "select * from drizzle.__drizzle_migrations", "select * from ops.errors", "select * from ops.emails"]) {
      check(`${me.name}: refused: ${sqlText}`, /permission denied/.test(await refused(c, sqlText)));
    }
  });
  section(`${me.name}: every table shows only their own rows; every attack refused`, before);
}

/**
 * Pilot Light's own tables (the `ops` schema; Pilot Light opens them to members, pilot-light's
 * lib/db/business/member-ops.ts). Two kinds only: members' own rows (a `member_id` column, the member policy), and
 * the business's shared setup, which members may read and nothing else.
 */
async function opsCatalog(): Promise<{ own: string[]; shared: string[] }> {
  const before = failed;
  const { rows } = await pool.query<{ name: string; has_member: boolean; sel: boolean; ins: boolean; upd: boolean; del: boolean; trunc: boolean; policies: { name: string; cmd: string; qual: string | null; with_check: string | null }[] }>(
    `select c.relname as name,
            exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'member_id' and not a.attisdropped) as has_member,
            has_table_privilege(r.oid, c.oid, 'SELECT') as sel, has_table_privilege(r.oid, c.oid, 'INSERT') as ins, has_table_privilege(r.oid, c.oid, 'UPDATE') as upd,
            has_table_privilege(r.oid, c.oid, 'DELETE') as del, has_table_privilege(r.oid, c.oid, 'TRUNCATE, REFERENCES, TRIGGER') as trunc,
            coalesce((select jsonb_agg(jsonb_build_object('name', p.polname, 'cmd', p.polcmd, 'qual', pg_get_expr(p.polqual, p.polrelid), 'with_check', pg_get_expr(p.polwithcheck, p.polrelid)))
                        from pg_policy p where p.polrelid = c.oid and (r.oid = any(p.polroles) or 0 = any(p.polroles))), '[]'::jsonb) as policies
       from pg_class c join pg_namespace n on n.oid = c.relnamespace cross join (select oid from pg_roles where rolname = $1) r
      where n.nspname = 'ops' and c.relkind in ('r', 'p')
        and (has_table_privilege(r.oid, c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER') or has_any_column_privilege(r.oid, c.oid, 'SELECT, INSERT, UPDATE, REFERENCES'))
      order by c.relname`,
    [ROLE],
  );
  const mine = `(member_id = NULLIF(current_setting('${SETTING}'::text, true), ''::text))`;
  const own: string[] = [];
  const shared: string[] = [];
  for (const t of rows) {
    const p = t.policies[0];
    check(`ops.${t.name}: the role can never TRUNCATE it (or reference or trigger on it)`, !t.trunc);
    if (t.has_member) {
      // The check on writes may add to the member's own rows (links only to rows they can see), never replace it.
      const ok = t.policies.length === 1 && p.name === "member_scope" && p.cmd === "*" && p.qual === mine && (p.with_check ?? "").includes(mine) && !/\bOR\b/.test((p.with_check ?? "").replace(/IS NULL\) OR \(EXISTS/g, ""));
      check(`ops.${t.name}: exactly one policy binds the role, and it is the member's own rows`, ok, t.policies.map((x) => `${x.name}: ${x.qual} / ${x.with_check}`).join(" | ") || "no policy");
      if (ok && t.sel) own.push(t.name);
    } else {
      check(`ops.${t.name}: the business's shared setup is read-only for members`, t.sel && !t.ins && !t.upd && !t.del && t.policies.length === 1 && p.name === "member_read" && p.cmd === "r", t.policies.map((x) => x.name).join(", ") || "no policy");
      shared.push(t.name);
    }
  }
  if (rows.length) section(`Pilot Light's own tables: ${own.length} hold members' own rows, ${shared.length} are the business's shared setup (read-only)`, before);
  return { own, shared };
}

/** As a member in Pilot Light's own tables, with rows for both members and the business made first; all rolled back. */
async function attackOps(ops: { own: string[]; shared: string[] }, me: { id: string; name: string }, other: { id: string; name: string }) {
  const before = failed;
  const c = await pool.connect();
  try {
    await c.query("begin");
    // As the database's own user: a conversation with a message for each member, and one of the business's own.
    const conversation: Record<string, string> = {};
    for (const [who, memberId] of [["mine", me.id], ["theirs", other.id], ["business", null]] as const) {
      const [row] = (await c.query("insert into ops.conversations (channel, member_id) values ('owner_chat', $1) returning id", [memberId])).rows;
      await c.query("insert into ops.messages (conversation_id, direction, author, body, status, member_id) values ($1, 'in', 'owner', 'db:check', 'received', $2)", [row.id, memberId]);
      conversation[who] = row.id;
    }
    await c.query(`set local role ${ROLE}`);
    await c.query("select set_config($1, $2, true)", [SETTING, me.id]);

    for (const t of ops.own) {
      const [r] = (await c.query(`select count(*) filter (where member_id is distinct from $1)::int as others from ops."${t}"`, [me.id])).rows;
      check(`${me.name} · ops.${t}: none of anyone else's rows, none of the business's`, r.others === 0, `${r.others} not theirs`);
    }
    const [seen] = (await c.query("select count(*)::int as n, bool_and(id = $2) as only_mine from ops.conversations where id = any($1::uuid[])", [Object.values(conversation), conversation.mine])).rows;
    check(`${me.name}: of three conversations (theirs, another member's, the business's) sees only their own`, seen.n === 1 && seen.only_mine);
    const [messages] = (await c.query("select count(*)::int as n from ops.messages where body = 'db:check'")).rows;
    check(`${me.name}: and only their own message`, messages.n === 1);
    const [stamped] = (await c.query("insert into ops.conversations (channel) values ('owner_chat') returning member_id")).rows;
    check(`${me.name}: a new conversation is stamped as theirs`, stamped.member_id === me.id);
    check(`${me.name}: can't start a conversation as another member`, /row-level security/.test(await refused(c, "insert into ops.conversations (channel, member_id) values ('owner_chat', $1)", [other.id])));
    check(`${me.name}: or as the business`, /row-level security/.test(await refused(c, "insert into ops.conversations (channel, member_id) values ('owner_chat', null)")));
    for (const who of ["theirs", "business"] as const) {
      check(`${me.name}: can't put a message into ${who === "theirs" ? "another member's" : "the business's"} conversation`, /row-level security/.test(await refused(c, "insert into ops.messages (conversation_id, direction, author, body, status) values ($1, 'in', 'owner', 'forged', 'received')", [conversation[who]])));
    }
    const upd = await c.query("update ops.conversations set subject = 'hacked' where id = any($1::uuid[])", [[conversation.theirs, conversation.business]]);
    check(`${me.name}: changing another member's or the business's conversation touches nothing`, upd.rowCount === 0);
    check(`${me.name}: can't delete conversations`, /permission denied/.test(await refused(c, "delete from ops.conversations")));
    for (const t of ops.shared) {
      check(`${me.name} · ops.${t}: can't change the business's shared setup`, /permission denied/.test(await refused(c, `delete from ops."${t}"`)));
    }

    // With no member named, none of it shows.
    await c.query("select set_config($1, '', true)", [SETTING]);
    for (const t of ops.own) {
      const [r] = (await c.query(`select count(*)::int as seen from ops."${t}"`)).rows;
      check(`no member named · ops.${t}: nothing shows`, r.seen === 0, `saw ${r.seen}`);
    }
  } finally {
    await c.query("rollback").catch(() => undefined);
    c.release();
  }
  section(`${me.name}: in Pilot Light's own tables, only their own rows; every attack refused`, before);
}

(async () => {
  try {
    const tables = await catalog();
    const ops = await opsCatalog();
    const { rows: members } = await pool.query<{ id: string; name: string }>("select id, business_name as name from members order by created_at, id limit 2");
    if (tables.length && members.length === 2) {
      await attack(tables, members[0], members[1]);
      await attack(tables, members[1], members[0]);
      if (ops.own.includes("conversations") && ops.own.includes("messages")) {
        await attackOps(ops, members[0], members[1]);
        await attackOps(ops, members[1], members[0]);
      }
      const before = failed;
      await asMember(null, async (c) => {
        for (const t of tables) {
          const [r] = (await c.query(`select count(*)::int as seen from "${t}"`)).rows;
          check(`no member named · ${t}: nothing shows`, r.seen === 0, `saw ${r.seen}`);
        }
      });
      section("with no member named, the role sees nothing at all", before);
    } else if (tables.length) {
      check("two members to test with (run npm run db:seed)", false, `${members.length} found`);
    }
  } catch (e) {
    failed++;
    console.error("✗ The check itself failed:", e);
  }
  await pool.end();
  console.log(failed ? `\n${failed} check(s) FAILED. Run with --verbose to see every check.` : "\nMember scope holds. (--verbose lists every check.)");
  process.exit(failed ? 1 : 0);
})();
