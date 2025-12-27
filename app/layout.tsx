import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Topdeck Compare",
  description: "Compare a Moxfield wishlist with a Topdeck forum listing.",
  icons: {
    icon: "/icon.png"
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
