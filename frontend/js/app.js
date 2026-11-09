/**
 * Clinic Booking System — Frontend Client Application
 * Communicates with backend API using same-origin secure client proxy.
 */

// Base API configuration (configurable via window.API_BASE_URL)
const API_BASE = window.API_BASE_URL || '/client-api';

// Utility: Generate unique UUID v4 for client-side Idempotency-Key
function generateIdempotencyKey() {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return 'idem-' + Date.now() + '-' + Math.random().toString(36).substring(2, 10);
}

// Utility: Format ISO 8601 date-time string into clean human-readable text
function formatDateTime(isoString) {
  if (!isoString) return '--';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return date.toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  } catch {
    return isoString;
  }
}

// Utility: Format time range
function formatSlotRange(startIso, endIso) {
  try {
    const s = new Date(startIso);
    const e = new Date(endIso);
    const dateStr = s.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
    const startTimeStr = s.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const endTimeStr = e.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `${dateStr} &bull; ${startTimeStr} – ${endTimeStr}`;
  } catch {
    return `${startIso} – ${endIso}`;
  }
}

// Utility: Display global alert banner
function showAlert(containerId, message, type = 'info', autoDismiss = 5000) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const alertEl = document.createElement('div');
  alertEl.className = `alert alert-${type}`;
  alertEl.innerHTML = `
    <div style="flex: 1;">${message}</div>
    <button type="button" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: inherit; line-height: 1;" aria-label="Dismiss">&times;</button>
  `;

  alertEl.querySelector('button').addEventListener('click', () => {
    alertEl.remove();
  });

  container.innerHTML = '';
  container.appendChild(alertEl);

  if (autoDismiss > 0) {
    setTimeout(() => {
      if (alertEl.parentElement) {
        alertEl.remove();
      }
    }, autoDismiss);
  }
}

/* ==========================================================================
   HOMEPAGE CONTROLLER (index.html)
   ========================================================================== */
function initHomePage() {
  const slotsGrid = document.getElementById('slots-grid');
  const slotsLoading = document.getElementById('slots-loading');
  const slotsEmpty = document.getElementById('slots-empty');
  const providerFilter = document.getElementById('provider-filter');
  const btnRefresh = document.getElementById('btn-refresh-slots');

  // Booking Modal Elements
  const modal = document.getElementById('booking-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalCancelBtn = document.getElementById('modal-cancel-btn');
  const bookingForm = document.getElementById('booking-form');
  const slotIdInput = document.getElementById('booking-slot-id');
  const patientNameInput = document.getElementById('patient-name');
  const patientEmailInput = document.getElementById('patient-email');
  const modalSlotProvider = document.getElementById('modal-slot-provider');
  const modalSlotTime = document.getElementById('modal-slot-time');
  const submitSpinner = document.getElementById('submit-spinner');
  const submitLabel = document.getElementById('submit-label');
  const btnSubmit = document.getElementById('btn-submit-booking');

  // Confirmation Card Elements
  const confSection = document.getElementById('confirmation-section');
  const confId = document.getElementById('conf-id');
  const confName = document.getElementById('conf-name');
  const confEmail = document.getElementById('conf-email');
  const confSlotId = document.getElementById('conf-slot-id');
  const confCreatedAt = document.getElementById('conf-created-at');
  const confBookAnotherBtn = document.getElementById('conf-book-another-btn');

  let currentSlots = [];

  // Load and render slots
  async function loadSlots(selectedProvider = '') {
    slotsLoading.style.display = 'block';
    slotsGrid.style.display = 'none';
    slotsEmpty.style.display = 'none';

    try {
      let url = `${API_BASE}/slots`;
      if (selectedProvider) {
        url += `?provider=${encodeURIComponent(selectedProvider)}`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      currentSlots = data.slots || [];

      // Populate doctor provider filter once if empty
      if (providerFilter && providerFilter.options.length <= 1) {
        const providers = [...new Set(currentSlots.map(s => s.provider).filter(Boolean))];
        providers.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p;
          opt.textContent = p;
          providerFilter.appendChild(opt);
        });
      }

      renderSlots(currentSlots);
    } catch (err) {
      slotsLoading.style.display = 'none';
      showAlert('alert-container', `Failed to load appointment slots: ${err.message}`, 'danger');
    }
  }

  function renderSlots(slots) {
    slotsLoading.style.display = 'none';
    slotsGrid.innerHTML = '';

    if (!slots || slots.length === 0) {
      slotsEmpty.style.display = 'block';
      return;
    }

    slotsGrid.style.display = 'grid';

    slots.forEach(slot => {
      const card = document.createElement('div');
      card.className = `slot-card ${slot.available ? 'available' : 'booked'}`;

      const badgeText = slot.available ? 'Available' : 'Booked';
      const badgeClass = slot.available ? 'badge-available' : 'badge-booked';

      card.innerHTML = `
        <div>
          <span class="slot-badge ${badgeClass}">${badgeText}</span>
          <div class="slot-provider">${escapeHtml(slot.provider)}</div>
          <div class="slot-time">${formatSlotRange(slot.start, slot.end)}</div>
        </div>
        <div>
          ${
            slot.available
              ? `<button class="btn btn-primary" style="width: 100%;" data-slot-id="${escapeHtml(slot.id)}">Book Appointment</button>`
              : `<button class="btn btn-outline" style="width: 100%;" disabled>Unavailable</button>`
          }
        </div>
      `;

      if (slot.available) {
        const bookBtn = card.querySelector('button');
        bookBtn.addEventListener('click', () => openBookingModal(slot));
      }

      slotsGrid.appendChild(card);
    });
  }

  // Open booking modal for selected slot
  function openBookingModal(slot) {
    slotIdInput.value = slot.id;
    modalSlotProvider.textContent = `Provider: ${slot.provider}`;
    modalSlotTime.innerHTML = formatSlotRange(slot.start, slot.end);
    document.getElementById('modal-alert-container').innerHTML = '';
    modal.classList.add('active');
    patientNameInput.focus();
  }

  function closeModal() {
    modal.classList.remove('active');
    bookingForm.reset();
  }

  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
  if (modalCancelBtn) modalCancelBtn.addEventListener('click', closeModal);

  // Close modal when clicking backdrop
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  // Booking Form Submission
  if (bookingForm) {
    bookingForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const slot_id = slotIdInput.value.trim();
      const name = patientNameInput.value.trim();
      const email = patientEmailInput.value.trim();

      if (!name) {
        showAlert('modal-alert-container', 'Please enter your full name.', 'danger');
        patientNameInput.focus();
        return;
      }

      if (!email || !email.includes('@')) {
        showAlert('modal-alert-container', 'Please provide a valid email address.', 'danger');
        patientEmailInput.focus();
        return;
      }

      // Generate idempotency key for this submission
      const idempotencyKey = generateIdempotencyKey();

      // UI Loading state
      btnSubmit.disabled = true;
      submitSpinner.style.display = 'inline-block';
      submitLabel.textContent = 'Securing Booking...';

      try {
        const res = await fetch(`${API_BASE}/bookings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey
          },
          body: JSON.stringify({ slot_id, name, email })
        });

        const data = await res.json().catch(() => ({}));

        if (res.status === 201) {
          // Success
          closeModal();
          showConfirmation(data);
          loadSlots(providerFilter.value);
          showAlert('alert-container', 'Appointment successfully confirmed!', 'success');
        } else if (res.status === 409) {
          showAlert('modal-alert-container', 'This slot was just booked by another patient. Please choose another slot.', 'danger');
          loadSlots(providerFilter.value);
        } else if (res.status === 429) {
          const retryAfter = res.headers.get('retry-after') || '60';
          showAlert('modal-alert-container', `Rate limit reached. Please wait ${retryAfter} seconds before trying again.`, 'danger');
        } else {
          showAlert('modal-alert-container', data.error || 'Failed to complete booking. Please try again.', 'danger');
        }
      } catch (err) {
        showAlert('modal-alert-container', `Network error: ${err.message}`, 'danger');
      } finally {
        btnSubmit.disabled = false;
        submitSpinner.style.display = 'none';
        submitLabel.textContent = 'Confirm Booking';
      }
    });
  }

  function showConfirmation(booking) {
    if (!confSection) return;
    confId.textContent = booking.id;
    confName.textContent = booking.name;
    confEmail.textContent = booking.email;
    confSlotId.textContent = booking.slot_id;
    confCreatedAt.textContent = formatDateTime(booking.created_at);

    // Store email in localStorage so bookings.html can automatically look it up
    try {
      localStorage.setItem('koya_last_email', booking.email);
    } catch (_) {}

    confSection.style.display = 'block';
    confSection.scrollIntoView({ behavior: 'smooth' });
  }

  if (confBookAnotherBtn) {
    confBookAnotherBtn.addEventListener('click', () => {
      confSection.style.display = 'none';
      document.getElementById('available-slots').scrollIntoView({ behavior: 'smooth' });
    });
  }

  if (providerFilter) {
    providerFilter.addEventListener('change', () => {
      loadSlots(providerFilter.value);
    });
  }

  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      loadSlots(providerFilter.value);
    });
  }

  // Initial load
  loadSlots();
}

/* ==========================================================================
   MY BOOKINGS CONTROLLER (bookings.html)
   ========================================================================== */
function initBookingsPage() {
  const searchEmailForm = document.getElementById('search-email-form');
  const searchEmailInput = document.getElementById('search-email-input');
  const searchEmailSpinner = document.getElementById('search-email-spinner');
  const btnSearchEmail = document.getElementById('btn-search-email');

  const searchIdForm = document.getElementById('search-id-form');
  const searchIdInput = document.getElementById('search-id-input');
  const searchIdSpinner = document.getElementById('search-id-spinner');

  // Single Result View
  const singleResult = document.getElementById('single-booking-result');
  const singleId = document.getElementById('single-id');
  const singleName = document.getElementById('single-name');
  const singleEmail = document.getElementById('single-email');
  const singleSlot = document.getElementById('single-slot');
  const singleStatusBadge = document.getElementById('single-status-badge');
  const singleCreated = document.getElementById('single-created');
  const singleActionContainer = document.getElementById('single-action-btn-container');
  const btnCloseSingleResult = document.getElementById('btn-close-single-result');

  // Paginated List View
  const listSection = document.getElementById('bookings-list-section');
  const listTitle = document.getElementById('bookings-results-title');
  const listBody = document.getElementById('bookings-table-body');
  const listLoading = document.getElementById('bookings-loading');
  const listEmpty = document.getElementById('bookings-empty');
  const tableWrapper = document.getElementById('bookings-table-wrapper');
  const pageIndicator = document.getElementById('page-indicator');
  const btnPrevPage = document.getElementById('btn-prev-page');
  const btnNextPage = document.getElementById('btn-next-page');

  // Cancellation Modal
  const cancelModal = document.getElementById('cancel-modal');
  const cancelCloseBtn = document.getElementById('cancel-modal-close-btn');
  const cancelAbortBtn = document.getElementById('cancel-modal-abort-btn');
  const cancelConfirmBtn = document.getElementById('cancel-modal-confirm-btn');
  const cancelTargetId = document.getElementById('cancel-target-id');
  const cancelSpinner = document.getElementById('cancel-spinner');
  const cancelLabel = document.getElementById('cancel-label');
  const cancelAlert = document.getElementById('cancel-modal-alert');

  // State for cursor pagination
  let activeEmail = '';
  let cursorStack = [null]; // stack of cursors for prev page navigation
  let currentCursorIndex = 0;
  let nextCursor = null;
  let targetBookingToCancel = null;

  // Pre-fill email from localStorage if available
  try {
    const savedEmail = localStorage.getItem('koya_last_email');
    if (savedEmail && searchEmailInput) {
      searchEmailInput.value = savedEmail;
    }
  } catch (_) {}

  // Search by Email
  if (searchEmailForm) {
    searchEmailForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = searchEmailInput.value.trim();
      if (!email) return;

      activeEmail = email;
      cursorStack = [null];
      currentCursorIndex = 0;
      fetchBookingsPage(null);
    });
  }

  async function fetchBookingsPage(cursor) {
    listSection.style.display = 'block';
    listLoading.style.display = 'block';
    tableWrapper.style.display = 'none';
    listEmpty.style.display = 'none';
    listTitle.textContent = `Bookings for ${activeEmail}`;

    btnSearchEmail.disabled = true;
    searchEmailSpinner.style.display = 'inline-block';

    try {
      let url = `${API_BASE}/bookings?email=${encodeURIComponent(activeEmail)}&limit=10`;
      if (cursor) {
        url += `&cursor=${encodeURIComponent(cursor)}`;
      }

      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const bookings = data.bookings || [];
      nextCursor = data.next_cursor;

      renderBookingsTable(bookings);
      updatePaginationControls();
    } catch (err) {
      listLoading.style.display = 'none';
      showAlert('alert-container', `Error fetching bookings: ${err.message}`, 'danger');
    } finally {
      btnSearchEmail.disabled = false;
      searchEmailSpinner.style.display = 'none';
    }
  }

  function renderBookingsTable(bookings) {
    listLoading.style.display = 'none';
    listBody.innerHTML = '';

    if (!bookings || bookings.length === 0) {
      listEmpty.style.display = 'block';
      tableWrapper.style.display = 'none';
      return;
    }

    tableWrapper.style.display = 'block';

    bookings.forEach(b => {
      const tr = document.createElement('tr');
      const isConfirmed = b.status === 'confirmed';
      const statusBadge = isConfirmed
        ? `<span class="status-tag status-confirmed">Confirmed</span>`
        : `<span class="status-tag status-cancelled">Cancelled</span>`;

      tr.innerHTML = `
        <td style="font-family: monospace; font-size: 0.85rem; color: var(--secondary);">${escapeHtml(b.id)}</td>
        <td style="font-weight: 600;">${escapeHtml(b.slot_id)}</td>
        <td>${escapeHtml(b.name)}<br><small style="color: var(--text-muted);">${escapeHtml(b.email)}</small></td>
        <td style="font-size: 0.85rem;">${formatDateTime(b.created_at)}</td>
        <td>${statusBadge}</td>
        <td style="text-align: right;">
          ${
            isConfirmed
              ? `<button class="btn btn-outline btn-cancel-booking" style="padding: 0.35rem 0.75rem; font-size: 0.85rem; color: var(--danger); border-color: #fecaca;" data-booking-id="${escapeHtml(b.id)}">Cancel</button>`
              : `<span style="font-size: 0.85rem; color: var(--text-muted);">None</span>`
          }
        </td>
      `;

      if (isConfirmed) {
        tr.querySelector('.btn-cancel-booking').addEventListener('click', () => {
          openCancelModal(b.id);
        });
      }

      listBody.appendChild(tr);
    });
  }

  function updatePaginationControls() {
    pageIndicator.textContent = `Page ${currentCursorIndex + 1}`;
    btnPrevPage.disabled = currentCursorIndex === 0;
    btnNextPage.disabled = !nextCursor;
  }

  btnNextPage.addEventListener('click', () => {
    if (!nextCursor) return;
    cursorStack.push(nextCursor);
    currentCursorIndex++;
    fetchBookingsPage(nextCursor);
  });

  btnPrevPage.addEventListener('click', () => {
    if (currentCursorIndex <= 0) return;
    currentCursorIndex--;
    const prevCursor = cursorStack[currentCursorIndex];
    fetchBookingsPage(prevCursor);
  });

  // Search by ID
  if (searchIdForm) {
    searchIdForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const bookingId = searchIdInput.value.trim();
      if (!bookingId) return;

      searchIdSpinner.style.display = 'inline-block';

      try {
        const res = await fetch(`${API_BASE}/bookings/${encodeURIComponent(bookingId)}`);
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data.error || 'Booking not found');
        }

        renderSingleBooking(data);
      } catch (err) {
        showAlert('alert-container', `Lookup failed: ${err.message}`, 'danger');
      } finally {
        searchIdSpinner.style.display = 'none';
      }
    });
  }

  function renderSingleBooking(b) {
    singleId.textContent = b.id;
    singleName.textContent = b.name;
    singleEmail.textContent = b.email;
    singleSlot.textContent = b.slot_id;
    singleCreated.textContent = formatDateTime(b.created_at);

    const isConfirmed = b.status === 'confirmed';
    singleStatusBadge.innerHTML = isConfirmed
      ? `<span class="status-tag status-confirmed">Confirmed</span>`
      : `<span class="status-tag status-cancelled">Cancelled</span>`;

    singleActionContainer.innerHTML = '';
    if (isConfirmed) {
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn btn-danger';
      cancelBtn.style.padding = '0.35rem 0.85rem';
      cancelBtn.style.fontSize = '0.85rem';
      cancelBtn.textContent = 'Cancel Booking';
      cancelBtn.addEventListener('click', () => openCancelModal(b.id));
      singleActionContainer.appendChild(cancelBtn);
    } else {
      singleActionContainer.textContent = 'No actions available';
    }

    singleResult.style.display = 'block';
    singleResult.scrollIntoView({ behavior: 'smooth' });
  }

  if (btnCloseSingleResult) {
    btnCloseSingleResult.addEventListener('click', () => {
      singleResult.style.display = 'none';
    });
  }

  // Cancel Modal Actions
  function openCancelModal(bookingId) {
    targetBookingToCancel = bookingId;
    cancelTargetId.textContent = bookingId;
    cancelAlert.innerHTML = '';
    cancelModal.classList.add('active');
  }

  function closeCancelModal() {
    cancelModal.classList.remove('active');
    targetBookingToCancel = null;
  }

  if (cancelCloseBtn) cancelCloseBtn.addEventListener('click', closeCancelModal);
  if (cancelAbortBtn) cancelAbortBtn.addEventListener('click', closeCancelModal);

  if (cancelConfirmBtn) {
    cancelConfirmBtn.addEventListener('click', async () => {
      if (!targetBookingToCancel) return;

      cancelConfirmBtn.disabled = true;
      cancelSpinner.style.display = 'inline-block';
      cancelLabel.textContent = 'Cancelling...';

      try {
        const res = await fetch(`${API_BASE}/bookings/${encodeURIComponent(targetBookingToCancel)}`, {
          method: 'DELETE'
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data.error || 'Failed to cancel');
        }

        closeCancelModal();
        showAlert('alert-container', `Booking ${targetBookingToCancel} cancelled successfully. The slot is now free.`, 'success');

        // Refresh current view
        if (activeEmail) {
          fetchBookingsPage(cursorStack[currentCursorIndex]);
        }
        if (singleResult.style.display !== 'none' && singleId.textContent === targetBookingToCancel) {
          renderSingleBooking(data);
        }
      } catch (err) {
        cancelAlert.innerHTML = `<div class="alert alert-danger" style="margin-top: 1rem;">${err.message}</div>`;
      } finally {
        cancelConfirmBtn.disabled = false;
        cancelSpinner.style.display = 'none';
        cancelLabel.textContent = 'Yes, Cancel Appointment';
      }
    });
  }
}

// Security: HTML string escape helper
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Router initialization based on page
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('slots-grid')) {
    initHomePage();
  }
  if (document.getElementById('search-email-form')) {
    initBookingsPage();
  }
});

