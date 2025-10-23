import { Router } from 'express';
import { authenticate, adminOnly } from '../middleware/auth.middleware';

const router = Router();

// All user routes require authentication
router.use(authenticate);

// Get current user profile
router.get('/me', async (req, res) => {
  // TODO: Implement get current user logic
  res.json({ message: 'Get current user - To be implemented', user: req.user });
});

// Update current user profile
router.put('/me', async (req, res) => {
  // TODO: Implement update current user logic
  res.json({ message: 'Update current user - To be implemented' });
});

// Admin only routes
router.get('/', adminOnly, async (req, res) => {
  // TODO: Implement get all users logic
  res.json({ message: 'Get all users - To be implemented' });
});

router.get('/:id', adminOnly, async (req, res) => {
  // TODO: Implement get user by id logic
  res.json({ message: 'Get user by id - To be implemented' });
});

router.post('/', adminOnly, async (req, res) => {
  // TODO: Implement create user logic
  res.json({ message: 'Create user - To be implemented' });
});

router.put('/:id', adminOnly, async (req, res) => {
  // TODO: Implement update user logic
  res.json({ message: 'Update user - To be implemented' });
});

router.delete('/:id', adminOnly, async (req, res) => {
  // TODO: Implement delete user logic
  res.json({ message: 'Delete user - To be implemented' });
});

export { router as userRouter };