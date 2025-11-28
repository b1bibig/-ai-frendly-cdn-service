import bcrypt from "bcryptjs";
import { sql } from "@/app/lib/db";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const authSecret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;

if (!authSecret && process.env.NODE_ENV === "production") {
  throw new Error("NEXTAUTH_SECRET or AUTH_SECRET must be set in production.");
}

async function findUserByEmail(email: string) {
  const result = await sql`
    SELECT id, email, password_hash, uid_token
    FROM users
    WHERE email = ${email}
    LIMIT 1
  `;

  return result.rows?.[0] as
    | { id: string; email: string; password_hash: string; uid_token?: string | null }
    | undefined;
}

async function verifyPassword(password: string, hashed: string) {
  try {
    return await bcrypt.compare(password, hashed);
  } catch (error) {
    console.error("Failed to compare passwords", error);
    return false;
  }
}

export const authOptions: NextAuthOptions = {
  secret: authSecret,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email?.toLowerCase().trim() ?? "";
        const password = credentials?.password ?? "";

        if (!EMAIL_REGEX.test(email) || !password) {
          throw new Error("Invalid email or password");
        }

        const user = await findUserByEmail(email);
        if (!user) {
          throw new Error("Invalid credentials");
        }

        const valid = await verifyPassword(password, user.password_hash);
        if (!valid) {
          throw new Error("Invalid credentials");
        }

        return {
          id: String(user.id),
          email: user.email,
          uidToken: user.uid_token,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id as string;
        token.email = (user as { email?: string | null })?.email ?? token.email;
        token.uidToken = (user as { uidToken?: string | null })?.uidToken || null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.uidToken = (token as { uidToken?: string | null })?.uidToken || null;
      }
      return session;
    },
  },
};
