import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth";
import { NavigationLoading } from "@/components/navigation-loading";
import "./globals.css";

export const metadata: Metadata = {
  title: "VENDORAQ",
  description: "A mock WhatsApp commerce and order manager for Nigerian sellers.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <NavigationLoading>{children}</NavigationLoading>
        </AuthProvider>
      </body>
    </html>
  );
}

