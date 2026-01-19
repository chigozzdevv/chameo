import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "chameo.cash",
  description: "Compliant private payouts with encrypted voting and analytics.",
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
