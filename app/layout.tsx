import "./globals.css";
import type { ReactNode } from "react";
import { Space_Grotesk } from "next/font/google";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata = {
  title: "Bunny CDN Uploader",
  description: "Upload images to Bunny Storage and serve from g.zcxv.xyz",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} app-body`}>
        <div className="bg-surface" />
        <div className="app-grid">
          <header className="app-header">
            <div className="brand">
              <div className="eyebrow">Bunny CDN / Storage</div>
              <h1>CDN Uploader</h1>
              <p>Invite 기반 로그인 + 업로드 관리</p>
            </div>
            <div className="header-actions">
              <a className="pill link" href="/">
                업로더
              </a>
              <a className="pill link" href="/dev">
                초대 관리
              </a>
              <a className="pill link" href="/account/tokens">
                API 토큰
              </a>
              <a className="pill link" href="/login">
                로그인
              </a>
            </div>
          </header>
          <main className="app-main">{children}</main>
          <footer className="app-footer">
            <span>CDN Base</span>
            <a href="https://g.zcxv.xyz" target="_blank" rel="noreferrer">
              g.zcxv.xyz
            </a>
          </footer>
        </div>
      </body>
    </html>
  );
}
