import { Router } from 'express';
import { getRepository } from '@server/datasource';
import { News } from '@server/entity/News';
import { isAuthenticated } from '@server/middleware/auth';
import { Permission } from '@server/lib/permissions';
import commentsRoutes from './comments';

const newsRoutes = Router();

newsRoutes.use('/comments', commentsRoutes);

// Get the 30 most recent news posts
newsRoutes.get('/', async (_req, res) => {
  const newsRepo = getRepository(News);
  const news = await newsRepo.find({
    order: { createdAt: 'DESC' },
    take: 30,
    relations: ['author'],
  });
  res.json(news);
});

// Post a news article (admin only)
newsRoutes.post(
  '/',
  isAuthenticated(Permission.ADMIN),
  async (req, res) => {
    const newsRepo = getRepository(News);
    const { subject, content } = req.body;
    // Strip all HTML tags except <b>, <i>, <a>, <img>
    const sanitizedContent = content.replace(
      /<(?!\/?(b|i|a|img)(\s|>|\/))/gi,
      '&lt;'
    );
    const news = newsRepo.create({
      subject,
      content: sanitizedContent,
      author: req.user,
    });
    await newsRepo.save(news);
    res.status(201).json(news);
  }
);

// Delete a news article (admin only)
newsRoutes.delete(
  '/:id',
  isAuthenticated(Permission.ADMIN),
  async (req, res) => {
    const newsRepo = getRepository(News);
    await newsRepo.delete(req.params.id);
    res.status(204).end();
  }
);

export default newsRoutes;