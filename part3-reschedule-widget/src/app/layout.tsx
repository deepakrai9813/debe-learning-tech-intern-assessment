import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Session Reschedule — Debe Learning",
  description:
    "Parent-facing widget to view upcoming tutoring sessions and request a reschedule.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
