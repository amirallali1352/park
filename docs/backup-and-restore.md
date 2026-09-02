# PostgreSQL Backup and Restore

The project provides Docker-based PostgreSQL backups without requiring `pg_dump`
to be installed on the host.

Create a timestamped backup:

```powershell
npm run db:backup
```

Create a backup at a specific path:

```powershell
npm run db:backup -- backups/pilot-before-migration.sql
```

Restore is intentionally destructive and requires an explicit confirmation flag:

```powershell
npm run db:restore -- backups/pilot-before-migration.sql --confirm
```

Verify a backup by restoring it into a temporary database and checking the
critical tables. The temporary database is removed after verification:

```powershell
npm run db:verify -- backups/pilot-before-migration.sql
```

Backups are plain SQL files and should be encrypted and copied to an external
WORM/object-storage target in the production environment. Always verify a
restore in an isolated PostgreSQL database before using it for recovery.
