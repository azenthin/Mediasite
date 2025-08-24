'use client';

import { useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import App from '../components/Main';

export default function UploadPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Redirect if not authenticated
  if (status === 'loading') {
    return (
      <App>
        <div className="flex justify-center items-center min-h-screen text-white">Loading...</div>
      </App>
    );
  }

  if (status === 'unauthenticated') {
    router.push('/auth/signin');
    return null;
  }

  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    const allowedTypes = [
      // Video formats
      'video/mp4', 'video/webm', 'video/ogg',
      // Audio formats
      'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3', 'audio/aac',
      // Image formats
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'
    ];

    const newFiles: File[] = [];
    let hasError = false;

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      
      if (!allowedTypes.includes(file.type)) {
        setError(`Unsupported file type: ${file.name}. Please select video, audio, or image files only.`);
        hasError = true;
        break;
      }

      if (file.size > 100 * 1024 * 1024) {
        setError(`File too large: ${file.name}. Please select files smaller than 100MB.`);
        hasError = true;
        break;
      }

      newFiles.push(file);
    }

    if (!hasError) {
      setFiles(prev => [...prev, ...newFiles]);
      setError('');
      setSuccess('');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    dropZoneRef.current?.classList.add('border-white', 'bg-[#444444]');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dropZoneRef.current?.classList.remove('border-white', 'bg-[#444444]');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dropZoneRef.current?.classList.remove('border-white', 'bg-[#444444]');
    
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      handleFileSelect(droppedFiles);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (files.length === 0) {
      setError('Please select at least one file to upload.');
      return;
    }

    if (!title.trim()) {
      setError('Please enter a title for your media.');
      return;
    }

    setIsUploading(true);
    setError('');
    setSuccess('');

    try {
      // Generate a groupId for related media
      const groupId = files.length > 1 ? `group_${Date.now()}_${Math.random().toString(36).substring(7)}` : null;
      
      // Upload all files
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        
        // Create metadata object
        const metadata = {
          title: files.length === 1 ? title : `${title} (${file.name})`,
          description,
          category,
          tags: [],
          isPublic: true
        };
        
        formData.append('metadata', JSON.stringify(metadata));
        if (groupId) {
          formData.append('groupId', groupId);
        }

        const response = await fetch('/api/media/upload', {
          method: 'POST',
          body: formData,
        });

        return response.json();
      });

      const results = await Promise.all(uploadPromises);
      const allSuccessful = results.every(result => result.media);

      if (allSuccessful) {
        setSuccess(`Upload successful! ${files.length} file(s) uploaded.`);
        setFiles([]);
        setTitle('');
        setDescription('');
        setCategory('general');
      } else {
        setError('Some files failed to upload. Please try again.');
      }
    } catch (error) {
      setError('Upload failed. Please check your connection and try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <App>
      <div className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-[#282828] rounded-lg shadow-lg p-8">
            <h1 className="text-3xl font-bold text-white mb-8">Upload Media</h1>
          
          {error && (
            <div className="mb-6 p-4 bg-red-900/20 border border-red-500 rounded-md">
              <p className="text-red-300">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-900/20 border border-green-500 rounded-md">
              <p className="text-green-300">{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* File Upload Area */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Media File
              </label>
              <div
                ref={dropZoneRef}
                className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-white transition-colors cursor-pointer bg-[#1a1a1a]"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*,audio/*,image/*"
                  multiple
                  onChange={(e) => {
                    handleFileSelect(e.target.files);
                  }}
                  className="hidden"
                />
                
                {files.length > 0 ? (
                  <div>
                    <div className="text-green-400 mb-2">
                      <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-lg font-medium text-white">{files.length} file(s) selected</p>
                    <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                      {files.map((file, index) => (
                        <div key={index} className="text-sm text-gray-400 flex justify-between items-center">
                          <span className="truncate">{file.name}</span>
                          <span>{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setFiles([])}
                      className="mt-2 text-sm text-red-400 hover:text-red-300"
                    >
                      Clear all files
                    </button>
                  </div>
                ) : (
                  <div>
                    <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                      <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <p className="mt-2 text-lg font-medium text-white">
                      Drop your media files here
                    </p>
                    <p className="mt-1 text-sm text-gray-400">
                      or click to browse
                    </p>
                    <p className="mt-2 text-xs text-gray-500">
                      Supports multiple MP4, WebM, OGG videos, MP3, WAV, OGG, AAC audio files, JPEG, PNG, GIF, SVG images (max 100MB each)
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-2">
                Title *
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 bg-[#444444] border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-white"
                placeholder="Enter a title for your media"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-2">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 bg-[#444444] border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-white"
                placeholder="Describe your media (optional)"
              />
            </div>

            {/* Category */}
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-300 mb-2">
                Category
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-[#444444] border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-white"
              >
                <option value="general">General</option>
                <option value="music">Music</option>
                <option value="tutorial">Tutorial</option>
                <option value="entertainment">Entertainment</option>
                <option value="education">Education</option>
                <option value="news">News</option>
                <option value="sports">Sports</option>
              </select>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isUploading || files.length === 0 || !title.trim()}
              className="w-full bg-[#444444] text-white py-3 px-4 rounded-md font-medium hover:bg-white hover:text-black focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#282828] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isUploading ? 'Uploading...' : `Upload ${files.length} File${files.length !== 1 ? 's' : ''}`}
            </button>
          </form>
          </div>
        </div>
      </div>
    </App>
  );
} 