import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "LLM Benchmark",
  description: "LLM Benchmark Web Application",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "monospace" }}>
        <nav
          style={{
            display: "flex",
            gap: "1.5rem",
            padding: "0.75rem 1.5rem",
            borderBottom: "1px solid #ccc",
            background: "#f8f8f8",
          }}
        >
          <Link href="/">Home</Link>
          <Link href="/settings">Settings</Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
