import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import DevConsole from "./DevConsole";
import { authOptions } from "@/lib/auth";

export default async function DevPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "admin") {
    redirect("/login");
  }

  return <DevConsole />;
}
