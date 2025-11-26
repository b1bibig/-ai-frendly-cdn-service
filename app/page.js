import { cookies } from "next/headers";
import UploaderClient from "./uploader-client";
import { verifySessionToken, getSessionTokenFromCookies } from "./lib/session";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const cookieStore = cookies();
  const sessionToken = getSessionTokenFromCookies(cookieStore);
  const session = verifySessionToken(sessionToken);

  return (
    <div className="panel">
      <UploaderClient
        initialUidToken={session?.uidToken || ""}
        userEmail={session?.email || ""}
      />
    </div>
  );
}
