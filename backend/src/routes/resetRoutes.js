import { Router } from 'express';
import { requireApiKey } from '../middleware/authMiddleware.js';
import { validateResetInput } from '../middleware/validationMiddleware.js';
import { handleReset } from '../controllers/resetController.js';

const router = Router();

router.post('/', requireApiKey, validateResetInput, handleReset);

export default router;
