import React, { useState } from 'react';
import useSWR from 'swr';
import axios from 'axios';
import { useUser } from '@app/hooks/useUser';
import Modal from '@app/components/Common/Modal';
import Button from '@app/components/Common/Button';
import { useToasts } from 'react-toast-notifications';
import NewsComments from '../components/News/NewsComments';

function stripTags(input: string) {
  return input.replace(/<(?!\/?(b|i|a|img)(\s|>|\/))/gi, '&lt;');
}

const NewsPage = () => {
  const { user, hasPermission } = useUser();
  const { data, mutate } = useSWR('/api/v1/news');
  const [showModal, setShowModal] = useState(false);
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [showComments, setShowComments] = useState<{ [key: number]: boolean }>(
    {}
  );
  const { addToast } = useToasts();

  const handlePost = async () => {
    try {
      await axios.post('/api/v1/news', {
        subject,
        content: stripTags(content),
      });
      setShowModal(false);
      setSubject('');
      setContent('');
      mutate();
    } catch {
      addToast('Failed to post news', { appearance: 'error' });
    }
  };

  const handleDelete = async (id: number) => {
    await axios.delete(`/api/v1/news/${id}`);
    mutate();
  };

  return (
    <div className="max-w-3xl mx-auto mt-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">News</h1>
        {hasPermission('ADMIN') && (
          <Button buttonType="primary" onClick={() => setShowModal(true)}>
            Post News
          </Button>
        )}
      </div>
      {data?.map((news: any) => (
        <div key={news.id} className="mb-8 p-4 rounded bg-gray-800 shadow">
          <div className="flex justify-between">
            <div>
              <div className="font-bold text-xl">{news.subject}</div>
              <div className="text-gray-400 text-sm mb-2">
                {new Date(news.createdAt).toLocaleString()} by {news.author.displayName}
              </div>
            </div>
            {hasPermission('ADMIN') && (
              <Button
                buttonType="danger"
                buttonSize="sm"
                onClick={() => handleDelete(news.id)}
              >
                Delete
              </Button>
            )}
          </div>
          <div
            className="mt-2 text-gray-200"
            dangerouslySetInnerHTML={{ __html: news.content }}
          />
          <NewsComments newsId={news.id} isAdmin={hasPermission('ADMIN')} />
        </div>
      ))}
      {showModal && (
        <Modal
          title="Post News"
          onCancel={() => setShowModal(false)}
          onOk={handlePost}
          okText="Post"
          cancelText="Cancel"
        >
          <div>
            <label className="block mb-2 font-semibold">Subject</label>
            <input
              className="w-full mb-4 p-2 rounded bg-gray-700 text-white"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={100}
            />
            <label className="block mb-2 font-semibold">News Text</label>
            <textarea
              className="w-full p-2 rounded bg-gray-700 text-white"
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
        </Modal>
      )}
    </div>
  );
};

export default NewsPage;