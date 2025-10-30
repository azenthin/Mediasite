// Cross-page preloader utility for instant navigation (YouTube Shorts style)
// This prevents the "stuck on previous page" feeling by preloading:
// - Page layout and structure
// - Initial media data
// - Player container

interface PreloadData {
    mediaData: any[];
    timestamp: number;
}

class PagePreloader {
    private static instance: PagePreloader;
    private preloadedPages: Map<string, PreloadData> = new Map();
    private isPreloading: Map<string, boolean> = new Map();

    static getInstance(): PagePreloader {
        if (!PagePreloader.instance) {
            PagePreloader.instance = new PagePreloader();
        }
        return PagePreloader.instance;
    }

    // Preload the recommended page from any other page
    async preloadRecommendedPage(): Promise<void> {
        const pageKey = 'recommended';
        
        if (this.isPreloading.get(pageKey) || this.preloadedPages.has(pageKey)) {
            return; // Already preloading or preloaded
        }

        this.isPreloading.set(pageKey, true);

        try {
            // Preload the page structure by creating a hidden container
            const preloadContainer = document.createElement('div');
            preloadContainer.style.position = 'absolute';
            preloadContainer.style.left = '-9999px';
            preloadContainer.style.top = '-9999px';
            preloadContainer.style.visibility = 'hidden';
            preloadContainer.className = 'recommended-container';
            document.body.appendChild(preloadContainer);

            // Preload initial media data
            const response = await fetch('/api/media/recommendations?limit=50');
            if (response.ok) {
                const data = await response.json();
                
                // Store preloaded data in sessionStorage for instant access
                const preloadData: PreloadData = {
                    mediaData: data.media || [],
                    timestamp: Date.now()
                };
                
                sessionStorage.setItem('recommendedPagePreloaded', JSON.stringify(preloadData));
                this.preloadedPages.set(pageKey, preloadData);
            }

            // Clean up preload container
            document.body.removeChild(preloadContainer);

        } catch (error) {
            console.warn('Failed to preload recommended page:', error);
        } finally {
            this.isPreloading.set(pageKey, false);
        }
    }

    // Check if a page has been preloaded
    isPagePreloaded(pageKey: string): boolean {
        return this.preloadedPages.has(pageKey) || sessionStorage.getItem(`${pageKey}PagePreloaded`) !== null;
    }

    // Get preloaded data for a page
    getPreloadedData(pageKey: string): PreloadData | null {
        // Check memory first
        if (this.preloadedPages.has(pageKey)) {
            return this.preloadedPages.get(pageKey) || null;
        }

        // Check sessionStorage
        const stored = sessionStorage.getItem(`${pageKey}PagePreloaded`);
        if (stored) {
            try {
                const data = JSON.parse(stored);
                // Store in memory for faster access
                this.preloadedPages.set(pageKey, data);
                return data;
            } catch (e) {
                return null;
            }
        }

        return null;
    }

    // Clear preloaded data for a page
    clearPreloadedData(pageKey: string): void {
        this.preloadedPages.delete(pageKey);
        sessionStorage.removeItem(`${pageKey}PagePreloaded`);
    }

    // Clear all preloaded data
    clearAllPreloadedData(): void {
        this.preloadedPages.clear();
        // Clear all preloaded data from sessionStorage
        Object.keys(sessionStorage).forEach(key => {
            if (key.endsWith('PagePreloaded')) {
                sessionStorage.removeItem(key);
            }
        });
    }
}

export const pagePreloader = PagePreloader.getInstance();

// Export the class for testing
export { PagePreloader };
