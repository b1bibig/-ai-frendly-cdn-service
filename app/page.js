import { cookies } from "next/headers";
import UploaderClient from "./uploader-client";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const cookieStore = cookies();
  const uidToken = cookieStore.get("uid_token")?.value || "";

  return (
    <div className="panel">
      <UploaderClient initialUidToken={uidToken} />
    </div>
  );
}
