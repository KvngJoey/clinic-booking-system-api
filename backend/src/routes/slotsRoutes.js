import { Router } from 'express';
import { requireApiKey } from '../middleware/authMiddleware.js';
import { handleGetSlots } from '../controllers/slotsController.js';

const router = Router();

router.get('/', requireApiKey, handleGetSlots);

export default router;
