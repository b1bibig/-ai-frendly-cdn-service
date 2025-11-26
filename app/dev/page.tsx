import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "../lib/auth";
import InvitesConsole from "./section";

export const dynamic = "force-dynamic";

export default async function DevPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (![UserRole.OWNER, UserRole.ADMIN].includes(user.role)) redirect("/");

  return (
    <div className="stack gap-lg">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">Admin</div>
          <h2 className="title">초대코드 관리</h2>
          <p className="muted">OWNER/ADMIN 전용 초대코드 발행 및 현황 조회</p>
        </div>
      </div>
      <div className="panel">
        <InvitesConsole />
      </div>
    </div>
  );
}
