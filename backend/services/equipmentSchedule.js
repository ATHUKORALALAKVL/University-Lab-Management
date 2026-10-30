
const Booking = require('../models/Booking');
const EquipmentItem = require('../models/EquipmentItem');
const EquipmentRepair = require('../models/EquipmentRepair');

const id = value => String(value?._id || value || '');

const ACTIVE = [
  'Approved',
  'Cancellation Requested'
];

const dateKey = value => {
  if (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}/.test(value)
  ) {
    return value.slice(0, 10);
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? ''
    : date.toISOString().slice(0, 10);
};

const overlapsTime = (a, b) =>
  a.startTime < b.endTime &&
  a.endTime > b.startTime;

// A retired unit must never be allocated again.
// Keep the existing treatment of other statuses.
const isPhysicallyUsable = unit =>
  Boolean(unit) &&
  unit.isRetired !== true &&
  !['Unavailable', 'Under Repair'].includes(unit.status);

async function getScheduleForBooking(
  booking,
  equipmentId,
  excludeBookingId = booking._id
) {
  const date = dateKey(booking.bookingDate);

  const [units, repairs, bookings] = await Promise.all([
    EquipmentItem.find({
      equipment: equipmentId
    }).lean(),

    EquipmentRepair.find({
      equipment: equipmentId,
      startDate: { $lte: date },
      endDate: { $gte: date },
      completedAt: null
    }).lean(),

    Booking.find({
      status: { $in: ACTIVE },
      bookingDate: booking.bookingDate,
      startTime: { $lt: booking.endTime },
      endTime: { $gt: booking.startTime },
      _id: { $ne: excludeBookingId }
    }).lean()
  ]);

  const repairIds = new Set(
    repairs.map(repair => id(repair.equipmentItem))
  );

  const reservedIds = new Set();

  let unassignedQuantity = 0;

  for (const other of bookings) {
    if (!overlapsTime(other, booking)) continue;

    const assigned = other.issuedEquipmentItems || [];

    if (assigned.length) {
      assigned.forEach(unitId =>
        reservedIds.add(id(unitId))
      );
    } else {
      const allocations =
        other.approvedEquipment?.length
          ? other.approvedEquipment
          : other.equipment || [];

      unassignedQuantity += allocations
        .filter(item =>
          id(item.equipmentId) === id(equipmentId)
        )
        .reduce(
          (total, item) =>
            total + Number(item.quantity || 0),
          0
        );
    }
  }

  const eligible = units.filter(unit =>
    isPhysicallyUsable(unit) &&
    !repairIds.has(id(unit)) &&
    !reservedIds.has(id(unit))
  );

  return {
    units,
    eligible,
    available: Math.max(
      0,
      eligible.length - unassignedQuantity
    ),
    repairIds,
    reservedIds,
    unassignedQuantity
  };
}

async function getUnitsForBooking(
  booking,
  equipmentId,
  excludeBookingId = booking._id
) {
  return getScheduleForBooking(
    booking,
    equipmentId,
    excludeBookingId
  );
}

async function getRepairConflicts(
  equipmentItemId,
  startDate,
  endDate
) {
  const bookings = await Booking.find({
    status: { $in: ACTIVE },
    issuedEquipmentItems: equipmentItemId
  }).lean();

  return bookings.filter(booking => {
    const date = dateKey(booking.bookingDate);

    return date >= startDate && date <= endDate;
  });
}

module.exports = {
  id,
  dateKey,
  ACTIVE,
  isPhysicallyUsable,
  getScheduleForBooking,
  getUnitsForBooking,
  getRepairConflicts
};
