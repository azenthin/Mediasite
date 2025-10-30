import './globals.css';
import Providers from './providers';
import ErrorBoundary from './components/ErrorBoundary';
import { SpeedInsights } from "@vercel/speed-insights/next";
import MaybeAnalytics from './components/MaybeAnalytics';

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
        {/* Skip Navigation for Accessibility */}
        <a 
          href="#main-content" 
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded focus:shadow-lg"
        >
          Skip to main content
        </a>
        
        <ErrorBoundary>
          <Providers>
            {children}
          </Providers>
        </ErrorBoundary>
  <SpeedInsights />
  <MaybeAnalytics />
      </body>
    </html>
  )
}