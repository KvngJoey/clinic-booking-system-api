import slotsService from '../services/slotsService.js';

export async function handleGetSlots(req, res, next) {
  try {
    const provider = req.query.provider;
    const slots = await slotsService.listSlots(provider);
    res.status(200).json({ slots });
  } catch (err) {
    next(err);
  }
}
