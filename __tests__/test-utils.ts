/**
 * Test utilities and mock data for MediaSite tests
 */

import { Session } from 'next-auth';

// Mock User Data
export const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  username: 'testuser',
  displayName: 'Test User',
  avatarUrl: 'https://example.com/avatar.jpg',
  emailVerified: true,
  password: 'hashed-password',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

// Mock Session
export const mockSession: Session = {
  user: {
    id: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
    displayName: 'Test User',
    avatarUrl: 'https://example.com/avatar.jpg',
  },
  expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
};

// Mock Media/Video Data
export const mockMedia = {
  id: 'media-123',
  title: 'Test Video',
  description: 'This is a test video',
  url: 'https://cloudinary.com/test-video.mp4',
  thumbnailUrl: 'https://cloudinary.com/test-thumbnail.jpg',
  type: 'video' as const,
  duration: 120,
  views: 1500,
  likes: 50,
  isPublic: true,
  uploaderId: 'user-123',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  uploader: mockUser,
};

// Mock Comment Data
export const mockComment = {
  id: 'comment-123',
  content: 'This is a test comment',
  mediaId: 'media-123',
  userId: 'user-123',
  likes: 5,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  user: mockUser,
};

// Mock Like Data
export const mockLike = {
  id: 'like-123',
  mediaId: 'media-123',
  userId: 'user-123',
  createdAt: new Date('2024-01-01'),
};

// Mock History Entry
export const mockHistory = {
  id: 'history-123',
  userId: 'user-123',
  mediaId: 'media-123',
  watchedAt: new Date('2024-01-01'),
  progress: 60,
  completed: false,
  media: mockMedia,
};

// Mock Prisma Client
export const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  media: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  comment: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  like: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  history: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
  },
};

// Helper to create mock Request
export function createMockRequest(options: {
  method?: string;
  url?: string;
  body?: any;
  headers?: Record<string, string>;
} = {}) {
  const {
    method = 'GET',
    url = 'http://localhost:3000/api/test',
    body = null,
    headers = {},
  } = options;

  return new Request(url, {
    method,
    headers: new Headers(headers),
    body: body ? JSON.stringify(body) : null,
  });
}

// Helper to create mock Response
export async function parseResponse(response: Response) {
  const contentType = response.headers.get('content-type');
  
  if (contentType?.includes('application/json')) {
    return {
      status: response.status,
      data: await response.json(),
    };
  }
  
  return {
    status: response.status,
    data: await response.text(),
  };
}

// Helper to mock getServerSession
export function mockGetServerSession(session: Session | null = mockSession) {
  return jest.fn().mockResolvedValue(session);
}

// Helper to create multiple mock media items
export function createMockMediaList(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    ...mockMedia,
    id: `media-${i}`,
    title: `Test Video ${i + 1}`,
    views: Math.floor(Math.random() * 10000),
    likes: Math.floor(Math.random() * 500),
  }));
}

// Helper to create mock FormData for file uploads
export function createMockFormData(overrides: Record<string, any> = {}) {
  const formData = new FormData();
  
  const defaults = {
    title: 'Test Upload',
    description: 'Test Description',
    type: 'video',
    isPublic: 'true',
    file: new File(['test content'], 'test.mp4', { type: 'video/mp4' }),
  };
  
  const data = { ...defaults, ...overrides };
  
  Object.entries(data).forEach(([key, value]) => {
    if (value instanceof File) {
      formData.append(key, value);
    } else {
      formData.append(key, String(value));
    }
  });
  
  return formData;
}
