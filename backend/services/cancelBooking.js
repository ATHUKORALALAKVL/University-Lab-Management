
const mongoose = require('mongoose');

const Booking = require('../models/Booking');
const EquipmentItem = require('../models/EquipmentItem');

const getId = value =>
  String(value?._id || value || '');

const ACTIVE_STATUSES = [
  'Approved',
  'Cancellation Requested'
];

/**
 * Cancel a booking safely.
 *
 * Assigned equipment IDs represent date-based
 * reservations and do not necessarily mean that
 * the physical equipment has been issued.
 *
 * Cancellation releases the reservation by
 * changing the booking status to Cancelled.
 */
async function cancelBooking({
  bookingId,
  allowedStatuses,
  cancellationReason,
  cancelledBy
}) {
  if (!mongoose.isValidObjectId(bookingId)) {
    const error = new Error('Invalid booking ID');
    error.statusCode = 400;
    throw error;
  }

  const booking = await Booking.findById(bookingId);

  if (!booking) {
    const error = new Error('Booking not found');
    error.statusCode = 404;
    throw error;
  }

  if (!allowedStatuses.includes(booking.status)) {
    const error = new Error(
      'Booking cannot be cancelled in its current status'
    );
    error.statusCode = 409;
    throw error;
  }

  const originalStatus = booking.status;

  const unitIds = [
    ...new Set(
      (booking.issuedEquipmentItems || [])
        .map(getId)
        .filter(Boolean)
    )
  ];

  // Pending bookings must not already have
  // assigned physical equipment IDs.
  if (
    originalStatus === 'Pending' &&
    unitIds.length > 0
  ) {
    const error = new Error(
      'Pending booking unexpectedly contains assigned equipment IDs. Please contact the administrator.'
    );
    error.statusCode = 409;
    throw error;
  }

  // Prevent cancellation when physical equipment
  // is currently issued to a user.
  if (unitIds.length > 0) {
    const units = await EquipmentItem.find({
      _id: { $in: unitIds }
    });

    if (units.length !== unitIds.length) {
      const error = new Error(
        'Some assigned equipment records are missing. Cancellation stopped for administrator review.'
      );
      error.statusCode = 409;
      throw error;
    }

    if (units.some(unit =>
      unit.status === 'Issued' || unit.issuedTo
    )) {
      const error = new Error(
        'One or more equipment units are physically issued. Please return them before cancelling the booking.'
      );
      error.statusCode = 409;
      throw error;
    }
  }

  // The booking's active status is what reserves
  // equipment for its scheduled date and time.
  // Cancelling releases that date-based reservation.
  //
  // Do not change EquipmentItem.status here.
  // This protects retired and under-repair units.

  const updated = await Booking.findOneAndUpdate(
    {
      _id: booking._id,
      status: originalStatus
    },
    {
      $set: {
        status: 'Cancelled',
        statusChangedAt: new Date(),
        cancellationReason,
        cancellationRequestedBy: cancelledBy,
        equipmentNeedsAttention: false,
        affectedEquipmentItems: []
      }
    },
    {
      new: true,
      runValidators: true
    }
  );

  if (!updated) {
    const error = new Error(
      'Booking status changed during cancellation. Please refresh.'
    );
    error.statusCode = 409;
    throw error;
  }

  return updated;
}

module.exports = cancelBooking;
