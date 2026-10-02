import type { Metadata } from "next";
import "./globals.css";
import PwaRegister from "./pwa-register";

export const metadata: Metadata = {
  title: "น้องทุเรียน — Durian Smart Farm",
  description: "ศูนย์บัญชาการสวนทุเรียน งาน ต้นทุน และฤดูการผลิต",
  manifest: "/manifest.webmanifest",
  applicationName: "Durian Smart Farm",
  appleWebApp: {
    capable: true,
    title: "น้องทุเรียน",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className="antialiased">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
