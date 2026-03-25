import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "GSB Swarm — Broker Control Dashboard",
  description: "Agent Gas Bible $GSB tokenized compute bank broker swarm management platform",
  keywords: ["GSB", "Virtuals Protocol", "ACP", "compute bank", "broker agents", "x402"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        <div className="flex h-screen overflow-hidden bg-background">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {children}
          </div>
        </div>
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: "hsl(0 0% 7%)",
              border: "1px solid hsl(4 85% 44% / 0.3)",
              color: "hsl(30 15% 88%)",
            },
          }}
        />
      </body>
    </html>
  );
}
