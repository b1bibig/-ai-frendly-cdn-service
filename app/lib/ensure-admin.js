import bcrypt from "bcryptjs";
import { sql } from "@vercel/postgres";

let ensurePromise;

async function columnExists(columnName) {
  const result = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = ${columnName}
    LIMIT 1
  `;

  return result.rows.length > 0;
}

export async function ensureAdminAccount() {
  if (ensurePromise) {
    return ensurePromise;
  }

  ensurePromise = (async () => {
 codex/implement-admin-account-creation-feature-u2m7ct
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();

    const email = process.env.ADMIN_EMAIL?.trim();
 main
    const password = process.env.ADMIN_PASSWORD;
    const uidToken = process.env.ADMIN_UID_TOKEN?.trim();

    if (!email || !password || !uidToken) {
      return;
    }

    try {
      const passwordHash = await bcrypt.hash(password, 10);
      const hasIsAdmin = await columnExists("is_admin");

 codex/implement-admin-account-creation-feature-u2m7ct
      // Normalize any existing admin record to the lowercased email to avoid
      // duplicates created by earlier seeds that retained mixed-case values.
      await sql`
        UPDATE users
        SET email = ${email}
        WHERE id IN (
          SELECT id FROM users
          WHERE lower(email) = ${email}
          ORDER BY id ASC
          LIMIT 1
        )
      `;

 main
      if (hasIsAdmin) {
        await sql`
          INSERT INTO users (email, password_hash, uid_token, is_admin)
          VALUES (${email}, ${passwordHash}, ${uidToken}, true)
          ON CONFLICT (email) DO NOTHING
        `;
      } else {
        await sql`
          INSERT INTO users (email, password_hash, uid_token)
          VALUES (${email}, ${passwordHash}, ${uidToken})
          ON CONFLICT (email) DO NOTHING
        `;
      }

      console.log(`Admin account ensured: ${email}`);
    } catch (error) {
      console.warn("Failed to ensure admin account", error);
    }
  })();

  return ensurePromise;
}
