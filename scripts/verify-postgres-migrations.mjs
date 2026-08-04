import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const migrationPaths = [
  join(projectRoot, "migrations/0001_better_auth.sql"),
  join(projectRoot, "migrations/0002_editor_role_grants.sql"),
];

async function expectDatabaseRejection(action, messagePattern) {
  let error;

  try {
    await action();
  } catch (caught) {
    error = caught;
  }

  assert.ok(error instanceof Error, "expected the database to reject the statement");
  assert.match(error.message, messagePattern);
}

const database = new PGlite();

try {
  const migrations = await Promise.all(
    migrationPaths.map((migrationPath) => readFile(migrationPath, "utf8")),
  );

  // Applying every migration twice proves the committed SQL is safe to replay.
  for (const migration of migrations) {
    await database.exec(migration);
  }
  for (const migration of migrations) {
    await database.exec(migration);
  }

  const tableResult = await database.query(
    `select tablename
       from pg_catalog.pg_tables
      where schemaname = 'public'
      order by tablename`,
  );
  const tableNames = tableResult.rows.map(({ tablename }) => tablename);

  assert.deepEqual(tableNames, [
    "account",
    "rateLimit",
    "session",
    "user",
    "verification",
    "vibesource_editor_role_grants",
  ]);

  const indexResult = await database.query(
    `select indexname
       from pg_catalog.pg_indexes
      where schemaname = 'public'
        and indexname in (
          'session_user_id_idx',
          'account_user_id_idx',
          'verification_identifier_idx',
          'vibesource_editor_role_grants_active_user_idx',
          'vibesource_editor_role_grants_auth_user_id_idx',
          'vibesource_editor_role_grants_active_actor_idx',
          'vibesource_editor_role_grants_granted_at_idx'
        )
      order by indexname`,
  );
  assert.equal(indexResult.rows.length, 7);

  await database.query(
    `insert into "user"
      (id, name, email, "emailVerified", "createdAt", "updatedAt")
     values
      ('auth-user-1', 'Migration QA 1', 'migration-1@example.test', true, now(), now()),
      ('auth-user-2', 'Migration QA 2', 'migration-2@example.test', true, now(), now())`,
  );

  await database.query(
    `insert into vibesource_editor_role_grants
      (auth_user_id, actor_id, role, granted_by, grant_reason)
     values
      ('auth-user-1', 'actor-1', 'editor', 'migration-test',
       'Initial editor access for migration verification')`,
  );

  await expectDatabaseRejection(
    () =>
      database.query(
        `insert into vibesource_editor_role_grants
          (auth_user_id, actor_id, role, granted_by, grant_reason)
         values
          ('auth-user-1', 'actor-duplicate', 'admin', 'migration-test',
           'Duplicate active user grant should be rejected')`,
      ),
    /vibesource_editor_role_grants_active_user_idx/,
  );

  await expectDatabaseRejection(
    () =>
      database.query(
        `insert into vibesource_editor_role_grants
          (auth_user_id, actor_id, role, granted_by, grant_reason)
         values
          ('auth-user-2', 'actor-invalid-role', 'owner', 'migration-test',
           'Unsupported role should be rejected by the database')`,
      ),
    /vibesource_editor_role_grants_role_check/,
  );

  await expectDatabaseRejection(
    () =>
      database.query(
        `insert into vibesource_editor_role_grants
          (auth_user_id, actor_id, role, granted_by, grant_reason)
         values
          ('auth-user-2', 'actor-short-reason', 'editor', 'migration-test', 'short')`,
      ),
    /vibesource_editor_role_grants_grant_reason_check/,
  );

  await expectDatabaseRejection(
    () =>
      database.query(
        `update vibesource_editor_role_grants
            set revoked_at = now()
          where auth_user_id = 'auth-user-1' and revoked_at is null`,
      ),
    /vibesource_editor_role_grants_revocation_complete/,
  );

  await database.query(
    `update vibesource_editor_role_grants
        set revoked_at = now(),
            revoked_by = 'migration-test',
            revoke_reason = 'Access removed after migration verification'
      where auth_user_id = 'auth-user-1' and revoked_at is null`,
  );

  await database.query(
    `insert into vibesource_editor_role_grants
      (auth_user_id, actor_id, role, granted_by, grant_reason)
     values
      ('auth-user-1', 'actor-regranted', 'license_reviewer', 'migration-test',
       'Fresh active grant after complete revocation')`,
  );

  await expectDatabaseRejection(
    () =>
      database.query(
        `insert into vibesource_editor_role_grants
          (auth_user_id, actor_id, role, granted_by, grant_reason)
         values
          ('auth-user-2', 'actor-regranted', 'editor', 'migration-test',
           'Duplicate active actor should be rejected')`,
      ),
    /vibesource_editor_role_grants_active_actor_idx/,
  );

  await expectDatabaseRejection(
    () => database.query(`delete from "user" where id = 'auth-user-1'`),
    /vibesource_editor_role_grants_auth_user_id_fkey/,
  );

  const grantResult = await database.query(
    `select role, revoked_at
       from vibesource_editor_role_grants
      where auth_user_id = 'auth-user-1'
      order by granted_at, id`,
  );

  assert.equal(grantResult.rows.length, 2);
  assert.equal(grantResult.rows[0].role, "editor");
  assert.ok(grantResult.rows[0].revoked_at instanceof Date);
  assert.equal(grantResult.rows[1].role, "license_reviewer");
  assert.equal(grantResult.rows[1].revoked_at, null);

  const versionResult = await database.query("select version()");
  console.log(
    JSON.stringify(
      {
        status: "passed",
        engine: versionResult.rows[0].version,
        migrations: migrationPaths.map((path) => path.slice(projectRoot.length + 1)),
        replayed: true,
        tables: tableNames.length,
        requiredIndexes: indexResult.rows.length,
        roleGrantChecks: 7,
      },
      null,
      2,
    ),
  );
} finally {
  await database.close();
}
