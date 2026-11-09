import storageService from './storageService.js';

class SlotsService {
  /**
   * List all slots with availability, optionally filtered by provider.
   * Sorted earliest start first.
   */
  async listSlots(providerFilter) {
    const [slots, bookings] = await Promise.all([
      storageService.getSlots(),
      storageService.getBookings()
    ]);

    // Active confirmed booking slot_ids set
    const bookedSlotIds = new Set(
      bookings
        .filter(b => b.status === 'confirmed')
        .map(b => b.slot_id)
    );

    let result = slots.map(slot => ({
      id: slot.id,
      provider: slot.provider,
      start: slot.start,
      end: slot.end,
      available: !bookedSlotIds.has(slot.id)
    }));

    if (providerFilter) {
      result = result.filter(slot => slot.provider === providerFilter);
    }

    // Sort earliest start first
    result.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    return result;
  }

  async getSlotById(slotId) {
    const slots = await storageService.getSlots();
    return slots.find(s => s.id === slotId) || null;
  }
}

export const slotsService = new SlotsService();
export default slotsService;

