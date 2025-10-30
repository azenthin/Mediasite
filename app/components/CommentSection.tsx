'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Comment {
  id: string;
  content: string;
  author: {
    id: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
  };
  createdAt: string;
  likes: number;
  replies: number;
  userLiked?: boolean;
  parentId?: string;
  recentReplies?: Comment[];
}

interface CommentSectionProps {
  isOpen: boolean;
  onClose: () => void;
  mediaId: string;
  mediaTitle: string;
  commentCount: number;
}

const CommentSection: React.FC<CommentSectionProps> = ({
  isOpen,
  onClose,
  mediaId,
  mediaTitle,
  commentCount
}) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [newComment]);

  // Fetch comments when section opens
  useEffect(() => {
    if (isOpen) {
      fetchComments();
    }
  }, [isOpen, mediaId]);

  const fetchComments = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/media/${mediaId}/comments`);
      if (response.ok) {
        const data = await response.json();
        setComments(data.comments || []);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/media/${mediaId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          content: newComment.trim(),
          parentId: replyingTo 
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (replyingTo) {
          // Update the parent comment's reply count
          setComments(prev => prev.map(comment => 
            comment.id === replyingTo 
              ? { ...comment, replies: comment.replies + 1 }
              : comment
          ));
        } else {
          // Add new top-level comment
          setComments(prev => [data.comment, ...prev]);
        }
        setNewComment('');
        setReplyingTo(null);
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLikeComment = async (commentId: string) => {
    try {
      const response = await fetch(`/api/comments/${commentId}/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setComments(prev => prev.map(comment => 
          comment.id === commentId 
            ? { ...comment, likes: data.likeCount, userLiked: data.liked }
            : comment
        ));
      }
    } catch (error) {
      console.error('Error liking comment:', error);
    }
  };

  const handleReply = (commentId: string) => {
    setReplyingTo(commentId);
    textareaRef.current?.focus();
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
  };

  const handleViewReplies = async (commentId: string) => {
    if (expandedReplies.has(commentId)) {
      setExpandedReplies(prev => {
        const newSet = new Set(prev);
        newSet.delete(commentId);
        return newSet;
      });
      return;
    }

    try {
      const response = await fetch(`/api/comments/${commentId}/replies`);
      if (response.ok) {
        const data = await response.json();
        // Update the comment with its replies
        setComments(prev => prev.map(comment => 
          comment.id === commentId 
            ? { ...comment, recentReplies: data.replies }
            : comment
        ));
        setExpandedReplies(prev => new Set([...prev, commentId]));
      }
    } catch (error) {
      console.error('Error fetching replies:', error);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Mobile: Bottom half overlay, Desktop: Side panel */}
          <motion.div
            initial={{ y: '100%', x: 0 }}
            animate={{ y: 0, x: 0 }}
            exit={{ y: '100%', x: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 h-[50vh] bg-gradient-to-b from-zinc-900/95 to-black/95 backdrop-blur-xl z-[60] flex flex-col rounded-t-3xl md:right-0 md:left-auto md:top-0 md:bottom-auto md:h-full md:w-full md:max-w-sm md:rounded-none md:bg-black"
          >
            {/* Header - Mobile: Drag handle + X, Desktop: YouTube style */}
            <div className="flex items-center justify-between px-4 pt-2 pb-3 md:py-3 md:border-b md:border-white/10">
              {/* Mobile drag handle */}
              <div className="mx-auto w-12 h-1.5 bg-white/20 rounded-full md:hidden"></div>
              
              {/* Desktop header */}
              <div className="hidden md:flex items-center space-x-4">
                <button
                  onClick={onClose}
                  className="text-white/70 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h2 className="text-lg font-medium text-white">
                  Comments
                </h2>
              </div>
              
              {/* Mobile close button */}
              <button
                onClick={onClose}
                className="absolute right-4 top-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors md:hidden"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              
              {/* Desktop header buttons */}
              <div className="hidden md:flex items-center space-x-4">
                <button className="text-white/70 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <button
                  onClick={onClose}
                  className="text-white/70 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Mobile: Comments title */}
            <div className="px-4 pb-2 md:hidden">
              <h2 className="text-lg font-semibold text-white">
                Comments {commentCount > 0 && <span className="text-white/60 text-base ml-1">({commentCount})</span>}
              </h2>
            </div>

            {/* Comments List - Scrollable */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {loading ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white/60"></div>
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center text-white/60 py-8 md:py-12 px-4">
                  <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-3 md:mb-4 rounded-full bg-white/5 flex items-center justify-center">
                    <svg className="w-6 h-6 md:w-8 md:h-8 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <p className="text-base md:text-lg font-medium">No comments yet</p>
                  <p className="text-sm mt-1">Be the first to comment!</p>
                </div>
              ) : (
                <div className="px-4 py-2">
                  {comments.map((comment) => (
                    <div key={comment.id} className="py-3 border-b border-white/5 last:border-b-0">
                      {/* Main Comment */}
                      <div className="flex space-x-3">
                        <img
                          src={comment.author.avatarUrl || `https://placehold.co/40x40/555555/ffffff?text=${comment.author.username.charAt(0).toUpperCase()}`}
                          alt={comment.author.username}
                          className="w-10 h-10 rounded-full flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-sm font-medium text-white">
                              {comment.author.displayName || comment.author.username}
                            </span>
                            <span className="text-xs text-white/60">
                              {formatTimeAgo(comment.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm text-white leading-relaxed mb-2">
                            {comment.content}
                          </p>
                          <div className="flex items-center space-x-6">
                            <button 
                              onClick={() => handleLikeComment(comment.id)}
                              className={`flex items-center space-x-1 transition-colors ${
                                comment.userLiked ? 'text-red-500' : 'text-white/60 hover:text-white'
                              }`}
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5A5.5 5.5 0 017.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3A5.5 5.5 0 0122 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                              </svg>
                              <span className="text-xs">{comment.likes}</span>
                            </button>
                            <button 
                              onClick={() => handleReply(comment.id)}
                              className="text-xs text-white/60 hover:text-white transition-colors"
                            >
                              Reply
                            </button>
                          </div>
                        </div>
                        <button className="text-white/60 hover:text-white transition-colors p-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        </button>
                      </div>

                      {/* Replies Section */}
                      {comment.replies > 0 && (
                        <div className="ml-13 mt-2">
                          {expandedReplies.has(comment.id) ? (
                            <div className="space-y-3">
                              {comment.recentReplies?.map((reply) => (
                                <div key={reply.id} className="flex space-x-3">
                                  <img
                                    src={reply.author.avatarUrl || `https://placehold.co/32x32/555555/ffffff?text=${reply.author.username.charAt(0).toUpperCase()}`}
                                    alt={reply.author.username}
                                    className="w-8 h-8 rounded-full flex-shrink-0"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center space-x-2 mb-1">
                                      <span className="text-sm font-medium text-white">
                                        {reply.author.displayName || reply.author.username}
                                      </span>
                                      <span className="text-xs text-white/60">
                                        {formatTimeAgo(reply.createdAt)}
                                      </span>
                                    </div>
                                    <p className="text-sm text-white/90 leading-relaxed mb-2">
                                      {reply.content}
                                    </p>
                                    <div className="flex items-center space-x-4">
                                      <button 
                                        onClick={() => handleLikeComment(reply.id)}
                                        className={`flex items-center space-x-1 transition-colors ${
                                          reply.userLiked ? 'text-red-500' : 'text-white/60 hover:text-white'
                                        }`}
                                      >
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5A5.5 5.5 0 017.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3A5.5 5.5 0 0122 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                                        </svg>
                                        <span className="text-xs">{reply.likes}</span>
                                      </button>
                                      <button 
                                        onClick={() => handleReply(comment.id)}
                                        className="text-xs text-white/60 hover:text-white transition-colors"
                                      >
                                        Reply
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                              {comment.replies > 3 && (
                                <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                                  View {comment.replies - 3} more replies
                                </button>
                              )}
                            </div>
                          ) : (
                            <button 
                              onClick={() => handleViewReplies(comment.id)}
                              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                            >
                              View {comment.replies} {comment.replies === 1 ? 'reply' : 'replies'}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Reply Form */}
                      {replyingTo === comment.id && (
                        <div className="ml-13 mt-3">
                          <form onSubmit={handleSubmitComment} className="space-y-2">
                            <div className="flex space-x-3">
                              <img
                                src="https://placehold.co/32x32/555555/ffffff?text=U"
                                alt="Your avatar"
                                className="w-8 h-8 rounded-full flex-shrink-0"
                              />
                              <div className="flex-1">
                                <textarea
                                  ref={textareaRef}
                                  value={newComment}
                                  onChange={(e) => setNewComment(e.target.value)}
                                  placeholder={`Reply to ${comment.author.displayName || comment.author.username}...`}
                                  className="w-full bg-transparent text-white placeholder-white/50 resize-none focus:outline-none text-sm border-b border-white/20 focus:border-white/40 transition-colors pb-1"
                                  rows={1}
                                  maxLength={500}
                                />
                                <div className="flex justify-between items-center mt-2">
                                  <span className="text-xs text-white/40">
                                    {newComment.length}/500
                                  </span>
                                  <div className="flex space-x-2">
                                    <button
                                      type="button"
                                      onClick={handleCancelReply}
                                      className="text-xs text-white/60 hover:text-white transition-colors"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="submit"
                                      disabled={!newComment.trim() || submitting}
                                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-white/10 disabled:cursor-not-allowed text-white px-3 py-1 rounded-full text-xs font-medium transition-colors"
                                    >
                                      {submitting ? 'Posting...' : 'Reply'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </form>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Comment Form - Sticky at bottom */}
            {!replyingTo && (
              <div className="border-t border-white/10 px-4 py-3 md:py-4 bg-black/50 backdrop-blur-sm">
                <form onSubmit={handleSubmitComment}>
                  <div className="flex space-x-3">
                    <img
                      src="https://placehold.co/40x40/555555/ffffff?text=U"
                      alt="Your avatar"
                      className="w-8 h-8 md:w-10 md:h-10 rounded-full flex-shrink-0"
                    />
                    <div className="flex-1">
                      <div className="relative">
                        <textarea
                          ref={textareaRef}
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Add a comment..."
                          className="w-full bg-white/5 text-white placeholder-white/50 resize-none focus:outline-none text-sm border border-white/10 focus:border-white/30 transition-colors rounded-lg px-3 py-2"
                          rows={1}
                          maxLength={500}
                          style={{ minHeight: '36px', maxHeight: '80px' }}
                        />
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-xs text-white/40">
                            {newComment.length}/500
                          </span>
                          <button
                            type="submit"
                            disabled={!newComment.trim() || submitting}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-white/10 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
                          >
                            {submitting ? 'Posting...' : 'Comment'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </form>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CommentSection;
