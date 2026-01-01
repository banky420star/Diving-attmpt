import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ButtonSoundListener } from "@/components/button-sound-listener";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Grilled Inc Dispatch",
  description:
    "Manager OS 26 and Driver OS 26 for real-time delivery dispatch.",
  keywords: [
    "Grilled Inc",
    "dispatch",
    "driver app",
    "manager dashboard",
    "delivery"
  ],
  authors: [{ name: "Grilled Inc" }],
  icons: {
    icon: "/logo.svg"
  },
  openGraph: {
    title: "Grilled Inc Dispatch",
    description: "Real-time delivery operations with Driver OS 26.",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Grilled Inc Dispatch",
    description: "Real-time delivery operations with Driver OS 26."
  }
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ButtonSoundListener />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
