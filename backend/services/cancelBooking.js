
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
 * Cancel a booking and release its physical equipment.
 *
 * Compatible with standalone local MongoDB.
 *
 * IMPORTANT:
 * This uses compensating rollback, not an atomic
 * MongoDB transaction. For strict atomicity, use
 * a MongoDB replica set with transactions.
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

  // Pending bookings have not been approved, so
  // they must not own any issued physical units.
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

  // Prevent releasing equipment assigned to another
  // active booking due to inconsistent legacy data.
  if (unitIds.length > 0) {
    const conflictingBooking = await Booking.findOne({
      _id: { $ne: booking._id },
      status: { $in: ACTIVE_STATUSES },
      issuedEquipmentItems: {
        $in: unitIds
      }
    }).select('_id');

    if (conflictingBooking) {
      const error = new Error(
        'An equipment ID is also assigned to another active booking. Cancellation stopped for safety.'
      );
      error.statusCode = 409;
      throw error;
    }
  }

  const units = unitIds.length
    ? await EquipmentItem.find({
        _id: { $in: unitIds }
      })
    : [];

  // Never silently skip missing physical equipment.
  if (units.length !== unitIds.length) {
    const error = new Error(
      'Some assigned equipment records are missing. Cancellation stopped for administrator review.'
    );
    error.statusCode = 409;
    throw error;
  }

  // A unit assigned to an approved booking should
  // currently be Issued.
  if (units.some(unit => unit.status !== 'Issued')) {
    const error = new Error(
      'One or more assigned equipment IDs are not marked Issued. Please resolve the inventory inconsistency first.'
    );
    error.statusCode = 409;
    throw error;
  }

  const releasedIds = [];

  async function restoreReleasedUnits() {
    const failedRestores = [];

    for (const id of releasedIds) {
      try {
        const restored = await EquipmentItem.updateOne(
          {
            _id: id,
            status: 'Available'
          },
          {
            $set: {
              status: 'Issued'
            }
          }
        );

        if (restored.modifiedCount !== 1) {
          failedRestores.push(id);
        }
      } catch (error) {
        console.error(
          'Failed to restore equipment:',
          id,
          error
        );

        failedRestores.push(id);
      }
    }

    return failedRestores;
  }

  try {
    // STEP 1: Release every assigned physical unit.
    // Conditional updates avoid overwriting another
    // status such as Under Repair.

    for (const unit of units) {
      const result = await EquipmentItem.updateOne(
        {
          _id: unit._id,
          status: 'Issued'
        },
        {
          $set: {
            status: 'Available'
          }
        }
      );

      if (result.modifiedCount !== 1) {
        throw new Error(
          `Could not release ${unit.equipmentId}`
        );
      }

      releasedIds.push(String(unit._id));
    }

    // STEP 2: Verify all units were released.
    if (unitIds.length > 0) {
      const availableCount =
        await EquipmentItem.countDocuments({
          _id: { $in: unitIds },
          status: 'Available'
        });

      if (availableCount !== unitIds.length) {
        throw new Error(
          'Equipment release verification failed'
        );
      }
    }

    // STEP 3: Change booking status only after
    // equipment release has succeeded.
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
          cancellationRequestedBy: cancelledBy
        }
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!updated) {
      throw new Error(
        'Booking status changed during cancellation. Please refresh.'
      );
    }

    // Clear the legacy issuedTo pointer only after
    // successful cancellation. The booking retains
    // its issuedEquipmentItems for audit history.
    if (unitIds.length > 0) {
      try {
        await EquipmentItem.updateMany(
          {
            _id: { $in: unitIds },
            status: 'Available'
          },
          {
            $set: {
              issuedTo: null
            }
          }
        );
      } catch (cleanupError) {
        // The cancellation has already succeeded.
        // Do not claim that it failed.
        console.error(
          'Non-critical issuedTo cleanup error:',
          cleanupError
        );
      }
    }

    return updated;
  } catch (error) {
    // The booking was not successfully changed to
    // Cancelled. Attempt to restore the units.
    const failedRestores = await restoreReleasedUnits();

    if (failedRestores.length > 0) {
      console.error(
        'CRITICAL: Equipment rollback incomplete:',
        failedRestores
      );

      const rollbackError = new Error(
        'Cancellation failed and some equipment could not be restored. Administrator intervention is required.'
      );

      rollbackError.statusCode = 500;
      throw rollbackError;
    }

    error.statusCode = error.statusCode || 409;
    throw error;
  }
}

module.exports = cancelBooking;
