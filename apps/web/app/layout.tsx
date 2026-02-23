import type { Metadata } from "next";

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
      <body>{children}</body>
    </html>
  );
}
