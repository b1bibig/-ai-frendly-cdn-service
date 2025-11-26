import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/lib/auth";
import TokenConsole from "./section";

export const dynamic = "force-dynamic";

export default async function TokensPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="stack gap-lg">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">API Tokens</div>
          <h2 className="title">내 API 키</h2>
          <p className="muted">X-API-Key 헤더로 업로드 등 API 호출에 사용합니다.</p>
        </div>
      </div>
      <div className="panel">
        <TokenConsole />
      </div>
    </div>
  );
}
