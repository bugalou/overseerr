import { Router } from 'express';
import { getRepository } from 'typeorm';
import { NewsComment } from '@server/entity/NewsComment';
import { News } from '@server/entity/News';
import { isAuthenticated, Permission } from '@server/middleware/auth';

const router = Router();

// Get comments for a news article
router.get('/:newsId', async (req, res) => {
  const repo = getRepository(NewsComment);
  const comments = await repo.find({
    where: { news: { id: req.params.newsId } },
    order: { createdAt: 'ASC' },
    relations: ['author'],
  });
  res.json(comments);
});

// Post a comment
router.post('/:newsId', isAuthenticated(), async (req, res) => {
  const repo = getRepository(NewsComment);
  const newsRepo = getRepository(News);
  const news = await newsRepo.findOneOrFail(req.params.newsId);
  const comment = repo.create({
    comment: req.body.comment,
    author: req.user,
    news,
  });
  await repo.save(comment);
  res.status(201).json(comment);
});

// Delete a comment (admin only)
router.delete('/:commentId', isAuthenticated(Permission.ADMIN), async (req, res) => {
  const repo = getRepository(NewsComment);
  await repo.delete(req.params.commentId);
  res.status(204).end();
});

export default router;