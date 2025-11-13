import Link from 'next/link';

const PrivacyPage = () => {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16 text-white">
      <h1 className="text-4xl font-semibold mb-6">Privacy Policy</h1>
      <p className="text-sm text-white/60 mb-10">
        Last updated: October 29, 2025
      </p>

      <section className="space-y-4 text-white/80 leading-relaxed">
        <p>
          Mediasite uses third-party services to help you discover, verify, and publish music playlists.
          This policy describes what data we request, how we use it, and the choices you have. For additional
          information, contact us at <a href="mailto:support@mediasite.app" className="underline text-blue-300">support@mediasite.app</a>.
        </p>

        <h2 className="text-2xl font-semibold text-white mt-8">Information We Collect</h2>
        <ul className="list-disc list-inside space-y-2">
          <li>
            <strong>Account information.</strong> When you create a Mediasite account we store your email,
            username, and display preferences so we can personalize the experience.
          </li>
          <li>
            <strong>Usage data.</strong> We log basic analytics (page views, playlist requests) to improve
            recommendations and reliability. These events never include media you watch outside Mediasite.
          </li>
          <li>
            <strong>OAuth tokens.</strong> When you connect Spotify or YouTube we temporarily store access
            tokens in-memory for the current session so we can create playlists on your behalf. Tokens are
            discarded after the session or when you disconnect.
          </li>
        </ul>

        <h2 className="text-2xl font-semibold text-white mt-8">How We Use Your Data</h2>
        <ul className="list-disc list-inside space-y-2">
          <li>Generate AI-curated playlists tailored to your prompts.</li>
          <li>Verify track availability on Spotify and YouTube with your consent.</li>
          <li>Create playlists inside the platforms you explicitly authorize.</li>
          <li>Improve product quality by measuring anonymous usage patterns.</li>
        </ul>

        <h2 className="text-2xl font-semibold text-white mt-8">YouTube API Disclosure</h2>
        <p>
          Mediasite uses the YouTube API Services to search for public music videos and to create playlists on your
          behalf when you connect your YouTube account. We only access public video metadata (title, channel, video ID)
          needed to build playlists. We do not download videos or store proprietary YouTube metadata beyond temporary
          caching for performance. You can revoke Mediasite&apos;s access at any time from your
          <a href="https://myaccount.google.com/permissions" className="underline text-blue-300 ml-1" target="_blank" rel="noopener noreferrer">Google Account permissions page</a>.
        </p>
        <p>
          Your use of YouTube through Mediasite is subject to the
          <a href="https://www.youtube.com/t/terms" className="underline text-blue-300 ml-1" target="_blank" rel="noopener noreferrer">YouTube Terms of Service</a>
          and <a href="https://policies.google.com/privacy" className="underline text-blue-300 ml-1" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a>.
        </p>

        <h2 className="text-2xl font-semibold text-white mt-8">Spotify API Disclosure</h2>
        <p>
          When you connect Spotify we request permission to create playlists. Track metadata is sourced directly from
          Spotify&apos;s public catalog. You may revoke access from
          <a href="https://www.spotify.com/account/apps/" className="underline text-blue-300 ml-1" target="_blank" rel="noopener noreferrer">your Spotify app settings</a>.
        </p>

        <h2 className="text-2xl font-semibold text-white mt-8">Data Retention</h2>
        <p>
          We retain account information for as long as the account remains active. Cached track metadata sourced from
          Spotify is refreshed regularly. We do not persist YouTube-only metadata without an accompanying Spotify or
          ISRC identifier. You may request deletion of your Mediasite account and associated data by contacting support.
        </p>

        <h2 className="text-2xl font-semibold text-white mt-8">Your Choices</h2>
        <ul className="list-disc list-inside space-y-2">
          <li>Disconnect Spotify or YouTube from within the AI Playlist view, or revoke access directly from the providers.</li>
          <li>Contact us to export or delete your Mediasite account data.</li>
          <li>Update notification and privacy preferences from your profile once available.</li>
        </ul>

        <p className="mt-10">
          Need more details? Reach out to us at <a href="mailto:support@mediasite.app" className="underline text-blue-300">support@mediasite.app</a>.
        </p>

        <p className="mt-4 text-sm text-white/60">
          Return to <Link href="/" className="underline">home</Link>.
        </p>
      </section>
    </main>
  );
};

export default PrivacyPage;
