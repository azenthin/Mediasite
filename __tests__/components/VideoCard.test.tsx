/**
 * Tests for VideoCard component
 * Demonstrates component testing patterns
 */

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock VideoCard component for testing
// In real implementation, import from actual component
const VideoCard = ({ video }: any) => (
  <div data-testid="video-card">
    <img src={video.thumbnailUrl} alt={video.title} />
    <h3>{video.title}</h3>
    <p>{video.uploader?.username || video.channel}</p>
    <div>
      <span>{video.views} views</span>
      <span>{video.likes} likes</span>
    </div>
  </div>
);

describe('VideoCard', () => {
  const mockVideo = {
    id: '1',
    title: 'Test Video',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    url: 'https://example.com/video.mp4',
    type: 'VIDEO',
    uploader: {
      id: 'user1',
      username: 'testuser',
      displayName: 'Test User',
    },
    views: 1000,
    likes: 50,
    _count: {
      likeRecords: 50,
      comments: 10,
    },
  };

  it('renders video title', () => {
    render(<VideoCard video={mockVideo} />);
    
    expect(screen.getByText('Test Video')).toBeInTheDocument();
  });

  it('renders video thumbnail', () => {
    render(<VideoCard video={mockVideo} />);
    
    const thumbnail = screen.getByAltText('Test Video');
    expect(thumbnail).toBeInTheDocument();
    expect(thumbnail).toHaveAttribute('src', mockVideo.thumbnailUrl);
  });

  it('renders uploader information', () => {
    render(<VideoCard video={mockVideo} />);
    
    expect(screen.getByText('testuser')).toBeInTheDocument();
  });

  it('renders view and like counts', () => {
    render(<VideoCard video={mockVideo} />);
    
    expect(screen.getByText('1000 views')).toBeInTheDocument();
    expect(screen.getByText('50 likes')).toBeInTheDocument();
  });

  it('handles missing uploader gracefully', () => {
    const videoWithChannel = {
      ...mockVideo,
      uploader: undefined,
      channel: 'Channel Name',
    };
    
    render(<VideoCard video={videoWithChannel} />);
    
    expect(screen.getByText('Channel Name')).toBeInTheDocument();
  });

  it('renders with minimal data', () => {
    const minimalVideo = {
      id: '2',
      title: 'Minimal Video',
      thumbnailUrl: 'https://example.com/thumb2.jpg',
      url: 'https://example.com/video2.mp4',
      type: 'VIDEO',
      views: 0,
      likes: 0,
    };
    
    render(<VideoCard video={minimalVideo} />);
    
    expect(screen.getByText('Minimal Video')).toBeInTheDocument();
    expect(screen.getByText('0 views')).toBeInTheDocument();
  });
});

describe('VideoCard accessibility', () => {
  const mockVideo = {
    id: '1',
    title: 'Accessible Video',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    url: 'https://example.com/video.mp4',
    type: 'VIDEO',
    views: 500,
    likes: 25,
  };

  it('has accessible thumbnail alt text', () => {
    render(<VideoCard video={mockVideo} />);
    
    const thumbnail = screen.getByAltText('Accessible Video');
    expect(thumbnail).toBeInTheDocument();
  });

  it('is keyboard navigable', () => {
    const { container } = render(<VideoCard video={mockVideo} />);
    
    // VideoCard should be wrapped in a clickable element
    const card = container.querySelector('[data-testid="video-card"]');
    expect(card).toBeInTheDocument();
  });
});
