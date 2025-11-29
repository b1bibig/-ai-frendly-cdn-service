import { sql } from "@vercel/postgres";
import { ensureAdminAccount } from "./ensure-admin";

ensureAdminAccount();

export { sql };
