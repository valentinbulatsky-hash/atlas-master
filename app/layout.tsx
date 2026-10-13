import type { Metadata } from "next";
import "./globals.css";
import { AtlasTheme } from "./workspace/theme";

export const metadata: Metadata = {
  title: "Атлас мастера",
  description: "Кампании, материалы, карты и связи вашего мира.",
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
    <html lang="ru" suppressHydrationWarning>
      <body className="antialiased"><AtlasTheme>{children}</AtlasTheme></body>
    </html>
  );
}
