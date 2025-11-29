import { getServerSession } from "next-auth";
import FileBrowserClient from "./file-browser-client";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="panel">
      <FileBrowserClient
        initialUidToken={session?.user?.uidToken || ""}
        userEmail={session?.user?.email || ""}
      />
    </div>
  );
}
