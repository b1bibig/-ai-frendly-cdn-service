// lib/auth.ts
import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

function adminCredentials() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

  if (!adminEmail || (!adminPassword && !adminPasswordHash)) return null;

  return { adminEmail, adminPassword, adminPasswordHash } as const;
}

async function verifyAdminPassword({
  adminPassword,
  adminPasswordHash,
  password,
}: {
  adminPassword?: string;
  adminPasswordHash?: string;
  password: string;
}) {
  if (adminPassword && password === adminPassword) return true;
  if (adminPasswordHash) {
    try {
      const match = await bcrypt.compare(password, adminPasswordHash);
      if (match) return true;
    } catch (error) {
      console.error("Failed to compare admin password hash", error);
    }
  }
  return false;
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      // 🔧 여기 1: 두 번째 인자(_req) 추가
      async authorize(credentials, _req) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const adminConfig = adminCredentials();
        if (
          adminConfig &&
          credentials.email === adminConfig.adminEmail &&
          (await verifyAdminPassword({
            adminPassword: adminConfig.adminPassword,
            adminPasswordHash: adminConfig.adminPasswordHash,
            password: credentials.password,
          }))
        ) {
          return {
            id: "admin",
            email: adminConfig.adminEmail,
            role: "admin",
          } as any;
        }

        // Prisma를 사용해서 유저 찾기
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          // 이메일 없음
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash // <- 이 필드명은 schema.prisma 기준으로 맞게 써둔 거겠지
        );

        if (!isValid) {
          // 비밀번호 틀림
          return null;
        }

        // 🔧 여기 2: id를 string으로 변환해서 리턴
        return {
          id: String(user.id),
          email: user.email,
          uidToken: user.uidToken,
          role: "user",
        } as any;
      },
    }),
  ],
  pages: {
    signIn: "/login", // 너 로그인 페이지 경로에 맞게 바꿔도 됨
  },
  callbacks: {
    async jwt({ token, user }) {
      // 로그인 직후 user 객체를 JWT에 실어보내기
      if (user) {
        token.userId = (user as any).id;
        token.uidToken = (user as any).uidToken;
        token.role = (user as any).role || token.role || "user";
        token.sub = (user as any).id ?? token.sub;
        token.email = (user as any).email ?? token.email;
      }
      return token;
    },
    async session({ session, token }) {
      // 세션 객체에 userId 심어주기
      if (session.user && token.userId) {
        (session.user as any).id = token.userId;
        (session.user as any).uidToken = token.uidToken;
        (session.user as any).role = token.role || "user";
      }
      return session;
    },
  },
};
