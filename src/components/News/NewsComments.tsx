// Add this inside your news article map in src/pages/news.tsx

import useSWR from 'swr';
import axios from 'axios';
import { useState } from 'react';

const NewsComments = ({ newsId, isAdmin }: { newsId: number; isAdmin: boolean }) => {
  const { data: comments, mutate } = useSWR(`/api/v1/news/comments/${newsId}`);
  const [comment, setComment] = useState('');
  const [posting, setPosting] = useState(false);

  const handlePost = async () => {
    if (!comment.trim()) return;
    setPosting(true);
    await axios.post(`/api/v1/news/comments/${newsId}`, { comment });
    setComment('');
    setPosting(false);
    mutate();
  };

  const handleDelete = async (id: number) => {
    await axios.delete(`/api/v1/news/comments/${id}`);
    mutate();
  };

  return (
    <div className="mt-4 bg-gray-900 rounded p-4">
      <div className="mb-2 font-semibold">Comments</div>
      <div className="space-y-2 mb-4">
        {comments?.map((c: any) => (
          <div key={c.id} className="border-b border-gray-700 pb-2">
            <div className="text-xs text-gray-400">
              {c.author.displayName} &middot; {new Date(c.createdAt).toLocaleString()}
              {isAdmin && (
                <button
                  className="ml-2 text-red-400 text-xs"
                  onClick={() => handleDelete(c.id)}
                >
                  Delete
                </button>
              )}
            </div>
            <div className="text-sm text-gray-200">{c.comment}</div>
          </div>
        ))}
      </div>
      <div className="flex items-center space-x-2">
        <input
          className="flex-1 p-2 rounded bg-gray-700 text-white"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Add a comment..."
        />
        <button
          className="px-3 py-1 bg-indigo-600 text-white rounded"
          onClick={handlePost}
          disabled={posting}
        >
          Post
        </button>
      </div>
    </div>
  );
};
export default NewsComments;