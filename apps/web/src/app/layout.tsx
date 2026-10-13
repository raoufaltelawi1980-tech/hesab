import type { Metadata } from "next";
import { Noto_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { Providers } from "./Providers";
import { DEFAULT_LOCALE, dirFor } from "@/lib/locale";

// Arabic is the default locale, so the sans stack must cover Arabic glyphs.
const hesabSans = Noto_Sans_Arabic({
  variable: "--font-hesab-sans",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "حساب — Hesab",
  description: "منصة حساب — دفاتر مالية للإدخال اليدوي",
  // Brand icons delivered in HISAB-Brand-CLEAN. The mask-based SVG is preferred;
  // the PNGs cover platforms that do not accept SVG icons.
  icons: {
    icon: [
      { url: "/brand/favicon.svg", type: "image/svg+xml" },
      { url: "/brand/icons/app-icon-512-dark.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/brand/icons/app-icon-512-light.png", sizes: "512x512" }],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang={DEFAULT_LOCALE} dir={dirFor(DEFAULT_LOCALE)} className="h-full">
      <body className={`${hesabSans.variable} min-h-full antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}