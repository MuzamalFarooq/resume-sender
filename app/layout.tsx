import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ResumeSender — Job search, thoughtfully managed",
  description: "Organize recruiter contacts and job application materials in one workspace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
