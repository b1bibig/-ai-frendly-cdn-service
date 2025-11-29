import "./globals.css";
import { Space_Grotesk } from "next/font/google";
import Providers from "./providers";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata = {
  title: "Bunny File Browser",
  description: "Upload and manage files in Bunny Storage from the web UI",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} app-body`}>
        <Providers>
          <div className="bg-surface" />
          <div className="app-grid">
            <header className="app-header">
              <div className="brand">
                <div className="eyebrow">Bunny CDN / Storage</div>
                <h1>File Browser</h1>
                <p>Explore and manage files with DB-backed indexing</p>
              </div>
              <div className="header-actions">
                <span className="pill">App Router</span>
                <a className="pill link" href="/dev">
                  Dev console
                </a>
                <a className="pill link" href="/login">
                  Set uidToken
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
        </Providers>
      </body>
    </html>
  );
}
