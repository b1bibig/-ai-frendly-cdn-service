import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import FileBrowserClient from "./file-browser-client";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="panel">
      <FileBrowserClient
        initialUidToken={session?.user?.uidToken || ""}
        userEmail={session?.user?.email || ""}
        userRole={session?.user?.role || ""}
      />
    </div>
  );
}
