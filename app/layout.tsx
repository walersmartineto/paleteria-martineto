import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SedeProvider } from "@/context/SedeContext";
import ClickGuard from "@/components/ClickGuard";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Paletería Martineto",
  description: "Sistema POS y Gestión de Sedes",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable} h-full antialiased min-h-full flex flex-col`}>
        <ClickGuard>
          <SedeProvider>
            {children}
          </SedeProvider>
        </ClickGuard>
      </body>
    </html>
  );
}