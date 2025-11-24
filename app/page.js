import UploaderClient from "./uploader-client";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <div className="panel">
      <UploaderClient initialUidToken="" />
    </div>
  );
}
