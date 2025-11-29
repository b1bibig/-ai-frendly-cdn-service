import "next-auth";
import type { DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user?: {
      id: string;
      email?: string | null;
      uidToken?: string | null;
      role?: string | null;
    };
  }

  interface User {
    id: string;
    uidToken?: string | null;
    role?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    uidToken?: string | null;
    role?: string | null;
    userId?: string;
  }
}
