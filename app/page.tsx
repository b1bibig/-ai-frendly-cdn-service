import { redirect } from "next/navigation";
import UploaderClient from "./uploader-client";
import { getCurrentUser } from "./lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="panel">
      <UploaderClient userId={user.id} userEmail={user.email} role={user.role} />
    </div>
  );
}
