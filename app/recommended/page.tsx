import App from '../components/Main';
import RecommendedPageContent from '../components/RecommendedPageContent';

// Hybrid approach: pre-render shell, dynamic content
export const revalidate = 3600; // Revalidate shell every hour

export default function RecommendedPage() {
  return (
    <App>
      <RecommendedPageContent />
    </App>
  );
} 