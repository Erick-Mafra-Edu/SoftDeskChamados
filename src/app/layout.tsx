import type { Metadata, Viewport } from "next";
import { Theme } from "@radix-ui/themes";
import "./globals.css";

export const metadata: Metadata = {
  title: "Softdesk Chamados PWA",
  description: "Painel PWA para analise, triagem e exploracao de chamados do Softdesk.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Softdesk Chamados",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f4fb4",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <Theme
          accentColor="blue"
          grayColor="slate"
          radius="large"
          scaling="100%"
          appearance="light"
        >
          {children}
        </Theme>
      </body>
    </html>
  );
}
