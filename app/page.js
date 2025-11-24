import { cookies } from "next/headers";
import UploaderClient from "./uploader-client";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const uidToken = cookies().get("uid_token")?.value || "";

  return (
    <div className="panel">
      <UploaderClient initialUidToken={uidToken} />
    </div>
  );
}
