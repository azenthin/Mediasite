import './globals.css';
import Providers from './providers';
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";

export const metadata = {
  title: 'MediaSite',
  description: 'A modern media streaming platform',
  other: {
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://vercel.live https://vercel.com https://*.vercel-scripts.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https://* https://picsum.photos https://placehold.co; media-src 'self' https://*; connect-src 'self' https://va.vercel-scripts.com https://vercel.live https://vercel.com https://*.vercel-scripts.com; object-src 'none'; base-uri 'self'",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
        </Providers>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  )
}