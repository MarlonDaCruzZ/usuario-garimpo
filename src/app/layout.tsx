import type { Metadata } from "next";
import "@fontsource/baloo-2/600.css";
import "@fontsource/baloo-2/700.css";
import "@fontsource/baloo-2/800.css";
import "@fontsource-variable/nunito-sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "Garimpo — o radar das melhores ofertas",
  description: "Coloque no radar o que você quer comprar. O Garimpo vasculha as lojas e avisa quando o preço cai.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
