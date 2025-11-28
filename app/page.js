import { getServerSession } from "next-auth";
import UploaderClient from "./uploader-client";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="panel">
      <UploaderClient
        initialUidToken={session?.user?.uidToken || ""}
        userEmail={session?.user?.email || ""}
      />
    </div>
  );
}
