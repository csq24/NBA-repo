import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import localFont from "next/font/local";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { getClerkPublishableKey, hasClerkConfigured } from "@/lib/clerk/env";
import { cn } from "@/lib/utils";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Scoreboard",
  description: "Live scores by league (ESPN)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const clerkOn = hasClerkConfigured();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("dark font-sans", geistSans.variable, geistMono.variable)}
      style={
        {
          ["--font-sans"]: "var(--font-geist-sans)",
          backgroundColor: "#09090b",
          color: "#fafafa",
        } as React.CSSProperties
      }
    >
      <body
        className={cn("min-h-dvh min-h-screen bg-zinc-950 text-zinc-100 antialiased")}
        style={{
          backgroundColor: "#09090b",
          color: "#fafafa",
          minHeight: "100dvh",
        }}
      >
        {clerkOn ? (
          <ClerkProvider publishableKey={getClerkPublishableKey()}>
            <Navbar authEnabled />
            {children}
          </ClerkProvider>
        ) : (
          <>
            <Navbar authEnabled={false} />
            {children}
          </>
        )}
      </body>
    </html>
  );
}
