import './globals.css';
import Providers from './providers';
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata = {
  title: 'MediaSite',
  description: 'A modern media streaming platform',
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
      </body>
    </html>
  )
}