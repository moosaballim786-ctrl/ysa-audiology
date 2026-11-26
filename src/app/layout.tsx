import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import { SwRegister } from "@/components/sw-register";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Yusuf Suder Audiology", template: "%s · YSA" },
  description: "Yusuf Suder Audiology — We're hear for you.",
  applicationName: "YSA",
  appleWebApp: { capable: true, title: "YSA", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#2A7F8F",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-ZA" className={`${inter.variable} ${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            classNames: {
              toast:
                "!rounded-2xl !border !border-border !bg-card !text-heading !shadow-float !font-sans !text-[14px]",
              description: "!text-muted",
              success: "[&_[data-icon]]:!text-sage",
              error: "[&_[data-icon]]:!text-coral",
            },
          }}
        />
        <SwRegister />
      </body>
    </html>
  );
}
