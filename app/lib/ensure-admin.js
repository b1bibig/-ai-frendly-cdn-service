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
    const normalizedEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    const uidToken = process.env.ADMIN_UID_TOKEN?.trim();

    if (!normalizedEmail || !password || !uidToken) {
      return;
    }

    try {
      const passwordHash = await bcrypt.hash(password, 10);
      const hasIsAdmin = await columnExists("is_admin");

      // Normalize any existing admin record to the lowercased email to avoid
      // duplicates created by earlier seeds that retained mixed-case values.
      // Avoid rewriting when a normalized row already exists to prevent
      // unique-index conflicts on the email column.
      await sql`
        UPDATE users
        SET email = ${normalizedEmail}
        WHERE id IN (
          SELECT id
          FROM users
          WHERE email <> ${normalizedEmail}
            AND lower(email) = ${normalizedEmail}
            AND NOT EXISTS (SELECT 1 FROM users WHERE email = ${normalizedEmail})
          ORDER BY id ASC
          LIMIT 1
        )
      `;

      if (hasIsAdmin) {
        await sql`
          INSERT INTO users (email, password_hash, uid_token, is_admin)
          VALUES (${normalizedEmail}, ${passwordHash}, ${uidToken}, true)
          ON CONFLICT (email) DO NOTHING
        `;
      } else {
        await sql`
          INSERT INTO users (email, password_hash, uid_token)
          VALUES (${normalizedEmail}, ${passwordHash}, ${uidToken})
          ON CONFLICT (email) DO NOTHING
        `;
      }

      console.log(`Admin account ensured: ${normalizedEmail}`);
    } catch (error) {
      console.warn("Failed to ensure admin account", error);
    }
  })();

  return ensurePromise;
}
