import { cookies } from "next/headers";
import UploaderClient from "./uploader-client";
import { verifySessionToken, getSessionTokenFromCookies } from "./lib/session";

export const dynamic = "force-dynamic";

export default function HomePage() {
  let session = null;

  try {
    const cookieStore = cookies();
    const sessionToken = getSessionTokenFromCookies(cookieStore);
    session = verifySessionToken(sessionToken);
  } catch (error) {
    console.error("Failed to read session from cookies", error);
  }

  return (
    <div className="panel">
      <UploaderClient
        initialUidToken={session?.uidToken || ""}
        userEmail={session?.email || ""}
      />
    </div>
  );
}
