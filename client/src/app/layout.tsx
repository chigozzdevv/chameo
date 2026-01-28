import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chameo - Compliant private payouts",
  description: "Compliant private payouts with encrypted voting and analytics.",
  icons: {
    icon: [
      { url: "/chameo-logo.png", type: "image/png" },
    ],
  },
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
