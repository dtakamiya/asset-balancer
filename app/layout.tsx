import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "アセットバランサー",
  description: "最適な資産配分でリバランスを管理し、投資パフォーマンスを向上させます",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
