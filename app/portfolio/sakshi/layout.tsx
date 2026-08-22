import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sakshi Kasat | SEO Strategist & Editorial Leader — Xredible",
  description:
    "Sakshi Kasat's portfolio featuring SEO strategy, editorial leadership, content, analytics and emerging AI capabilities.",
  keywords: [
    "Sakshi Kasat",
    "SEO Strategist",
    "SEO",
    "Content Strategy",
    "Editorial Strategy",
    "Digital Marketing",
    "AI Content",
    "Xredible",
  ],
  openGraph: {
    title: "Sakshi Kasat | SEO Strategist & Editorial Leader",
    description:
      "SEO strategy, editorial leadership, content, analytics and emerging AI capabilities.",
    type: "website",
    url: "https://xredible.in/portfolio/sakshi",
    siteName: "Xredible",
  },
};

export default function SakshiPortfolioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}