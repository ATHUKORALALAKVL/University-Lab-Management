const express = require('express');
const mongoose = require('mongoose');

const User = require('../models/User');
const Booking = require('../models/Booking');
const Equipment = require('../models/Equipment');
const EquipmentItem = require('../models/EquipmentItem');

const protect = require('../middleware/authMiddleware');
const adminOnly = require('../middleware/adminMiddleware');

const {
  dateKey,
  getScheduleForBooking,
  isPhysicallyUsable
} = require('../services/equipmentSchedule');

const router = express.Router();

router.use(protect, adminOnly);

// =====================================================
// COMMON HELPERS
// =====================================================

const validId = value => mongoose.isValidObjectId(value);

const getId = value =>
  String(value?._id || value || '');

const same = (a, b) => getId(a) === getId(b);

const isEquipmentBooking = booking =>
  booking.bookingType === 'equipment';

const ACTIVE_STATUSES = [
  'Approved',
  'Cancellation Requested'
];

const populateOptions = [
  {
    path: 'lab',
    select: 'name'
  },
  {
    path: 'equipment.equipmentId',
    select: 'name code lab',
    populate: {
      path: 'lab',
      select: 'name'
    }
  },
  {
    path: 'approvedEquipment.equipmentId',
    select: 'name code lab',
    populate: {
      path: 'lab',
      select: 'name'
    }
  },
  {
    path: 'issuedEquipmentItems',
    select: 'equipmentId equipment status isRetired'
  },
  {
    path: 'affectedEquipmentItems',
    select: 'equipmentId equipment status isRetired'
  }
];

const populateBooking = query =>
  query.populate(populateOptions);

const populateBookingDocument = async booking => {
  await booking.populate(populateOptions);
  return booking;
};

const getAllocations = booking =>
  booking.approvedEquipment?.length
    ? booking.approvedEquipment
    : booking.equipment || [];

const isPastBooking = booking =>
  dateKey(booking.bookingDate) < dateKey(new Date());

const getAssignedIds = booking =>
  (booking.issuedEquipmentItems || []).map(getId);

// =====================================================
// STAFF VERIFICATION
// =====================================================

router.get('/pending-staff', async (req, res) => {
  try {
    const users = await User.find({
      staffRequested: true,
      role: 'student'
    }).select('name email createdAt');

    res.json(users);
  } catch (error) {
    console.error('Pending staff error:', error);

    res.status(500).json({
      message: 'Unable to load staff requests'
    });
  }
});

router.patch('/approve-staff/:id', async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({
        message: 'Invalid user ID'
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    if (!user.staffRequested || user.role !== 'student') {
      return res.status(400).json({
        message: 'No pending staff request'
      });
    }

    user.role = 'staff';
    user.staffRequested = false;
    user.staffVerificationStatus = 'approved';

    await user.save();

    res.json({
      message: 'Instructor account approved successfully'
    });
  } catch (error) {
    console.error('Approve staff error:', error);

    res.status(500).json({
      message: 'Failed to approve instructor'
    });
  }
});

router.patch('/reject-staff/:id', async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({
        message: 'Invalid user ID'
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    if (!user.staffRequested || user.role !== 'student') {
      return res.status(400).json({
        message: 'No pending staff request'
      });
    }

    user.staffRequested = false;
    user.staffVerificationStatus = 'rejected';

    await user.save();

    res.json({
      message: 'Staff registration request rejected successfully'
    });
  } catch (error) {
    console.error('Reject staff error:', error);

    res.status(500).json({
      message: 'Failed to reject staff request'
    });
  }
});

// =====================================================
// GET ALL BOOKINGS
// =====================================================

router.get('/bookings', async (req, res) => {
  try {
    const bookings = await populateBooking(
      Booking.find().sort({
        createdAt: -1,
        _id: -1
      })
    );

    const users = await User.find({})
      .select('_id email role registrationNo');

    const usersByEmail = new Map();
    const usersById = new Map();

    for (const user of users) {
      const email = String(user.email || '')
        .trim()
        .toLowerCase();

      usersById.set(String(user._id), user);

      if (email) {
        usersByEmail.set(email, user);
      }
    }

    const results = bookings.map(booking => {
      const result = booking.toObject();

      result.bookingType =
        result.bookingType || 'lab';

      const email = String(booking.studentEmail || '')
        .trim()
        .toLowerCase();

      const userReference =
        booking.userId ||
        booking.user ||
        booking.studentId ||
        booking.requestedBy;

      const referencedId =
        userReference?._id || userReference;

      const matchedUser =
        (
          referencedId &&
          usersById.get(String(referencedId))
        ) ||
        usersByEmail.get(email);

      const role = String(
        booking.requesterRole ||
        matchedUser?.role ||
        ''
      ).trim().toLowerCase();

      result.requesterRole = role || null;

      result.registrationNo =
        role === 'student'
          ? matchedUser?.registrationNo || null
          : null;

      if (role === 'staff' || role === 'instructor') {
        result.requesterType = 'Staff Member';
      } else if (role === 'student') {
        result.requesterType = 'Student';
      } else if (role === 'admin') {
        result.requesterType = 'Administrator';
      } else {
        result.requesterType = 'Unknown';
      }

      return result;
    });

    res.json(results);
  } catch (error) {
    console.error('Load bookings error:', error);

    res.status(500).json({
      message: 'Failed to load booking requests'
    });
  }
});

// =====================================================
// DATE-BASED AVAILABILITY
// =====================================================

async function getAvailability(booking) {
  const equipmentOnly = isEquipmentBooking(booking);

  const overlapping = await Booking.find({
    _id: { $ne: booking._id },
    bookingDate: booking.bookingDate,
    status: { $in: ACTIVE_STATUSES },
    startTime: { $lt: booking.endTime },
    endTime: { $gt: booking.startTime }
  });

  let labAvailable = true;

  if (!equipmentOnly) {
    labAvailable = !overlapping.some(other =>
      !isEquipmentBooking(other) &&
      same(other.lab, booking.lab)
    );
  }

  const equipment = [];

  for (const requested of booking.equipment || []) {
    const record = await Equipment.findById(
      requested.equipmentId
    ).populate('lab', 'name');

    if (!record) {
      equipment.push({
        equipmentId: requested.equipmentId,
        name: 'Deleted Equipment',
        lab: null,
        requested: requested.quantity,
        available: 0,
        maximumAllocation: 0
      });

      continue;
    }

    const schedule = await getScheduleForBooking(
      booking,
      record._id
    );

    const sameLab =
      equipmentOnly || same(record.lab, booking.lab);

    const available =
      record.isAvailable && sameLab
        ? schedule.available
        : 0;

    const physicallyUsable = schedule.units.filter(
      unit => isPhysicallyUsable(unit)
    ).length;

    equipment.push({
      equipmentId: record._id,
      name: record.name,
      code: record.code,
      lab: record.lab
        ? {
            _id: record.lab._id,
            name: record.lab.name
          }
        : null,
      requested: requested.quantity,
      available,
      physicalAvailable: schedule.eligible.length,
      physicalUsable: physicallyUsable,
      reserved:
        schedule.reservedIds.size +
        schedule.unassignedQuantity,
      maximumAllocation: Math.min(
        requested.quantity,
        available
      )
    });
  }

  return {
    bookingType: equipmentOnly ? 'equipment' : 'lab',
    labAvailable,
    equipment
  };
}

// =====================================================
// GET BOOKING AVAILABILITY
// =====================================================

router.get('/bookings/:id/availability', async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({
        message: 'Invalid booking ID'
      });
    }

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        message: 'Booking not found'
      });
    }

    res.json(await getAvailability(booking));
  } catch (error) {
    console.error('Availability error:', error);

    res.status(500).json({
      message: 'Failed to check booking availability'
    });
  }
});

// =====================================================
// GET ELIGIBLE INDIVIDUAL EQUIPMENT IDS
// =====================================================

router.get('/bookings/:id/equipment-items', async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({
        message: 'Invalid booking ID'
      });
    }

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        message: 'Booking not found'
      });
    }

    const results = [];

    const requestedEquipment =
      booking.status === 'Approved' &&
      booking.approvedEquipment?.length
        ? booking.approvedEquipment
        : booking.equipment || [];

    for (const requested of requestedEquipment) {
      const equipment = await Equipment.findById(
        requested.equipmentId
      ).populate('lab', 'name');

      if (!equipment) continue;

      const schedule = await getScheduleForBooking(
        booking,
        equipment._id
      );

      const sameLab =
        isEquipmentBooking(booking) ||
        same(equipment.lab, booking.lab);

      const eligibleUnits =
        equipment.isAvailable && sameLab
          ? schedule.eligible
          : [];

      const items = [...eligibleUnits]
        .sort((a, b) =>
          String(a.equipmentId).localeCompare(
            String(b.equipmentId)
          )
        )
        .map(item => ({
          _id: item._id,
          equipmentId: item.equipmentId,
          status: 'Available'
        }));

      results.push({
        equipmentId: equipment._id,
        name: equipment.name,
        code: equipment.code,
        lab: equipment.lab
          ? {
              _id: equipment.lab._id,
              name: equipment.lab.name
            }
          : null,
        requestedQuantity: requested.quantity,
        availableQuantity: Math.min(
          items.length,
          schedule.available
        ),
        items
      });
    }

    res.json(results);
  } catch (error) {
    console.error('Load equipment IDs error:', error);

    res.status(500).json({
      message: 'Failed to load individual equipment IDs'
    });
  }
});

// =====================================================
// VALIDATE INDIVIDUAL EQUIPMENT IDS
// =====================================================

async function validateUnits(allocations, ids, booking) {
  if (!Array.isArray(allocations)) {
    throw new Error('Invalid equipment allocations');
  }

  const selectedIds = ids === undefined ? [] : ids;

  if (
    !Array.isArray(selectedIds) ||
    selectedIds.some(value => !validId(value)) ||
    new Set(selectedIds.map(String)).size !==
      selectedIds.length
  ) {
    throw new Error(
      'Provide valid, unique individual equipment IDs'
    );
  }

  if (
    allocations.some(item =>
      !Number.isInteger(item.quantity) ||
      item.quantity < 0
    )
  ) {
    throw new Error(
      'Invalid approved equipment quantity'
    );
  }

  const expected = allocations.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  if (selectedIds.length !== expected) {
    throw new Error(
      `Select exactly ${expected} individual equipment IDs`
    );
  }

  if (expected === 0) {
    return [];
  }

  const units = await EquipmentItem.find({
    _id: { $in: selectedIds }
  });

  if (units.length !== selectedIds.length) {
    throw new Error(
      'One or more selected equipment IDs do not exist'
    );
  }

  for (const allocation of allocations) {
    const matchingUnits = units.filter(unit =>
      same(unit.equipment, allocation.equipmentId)
    );

    if (matchingUnits.length !== allocation.quantity) {
      throw new Error(
        'Selected IDs must match approved equipment quantities'
      );
    }

    const equipment = await Equipment.findById(
      allocation.equipmentId
    );

    if (
      !equipment ||
      !equipment.isAvailable ||
      (
        !isEquipmentBooking(booking) &&
        !same(equipment.lab, booking.lab)
      )
    ) {
      throw new Error(
        'Equipment is unavailable or belongs to another laboratory'
      );
    }

    const schedule = await getScheduleForBooking(
      booking,
      allocation.equipmentId
    );

    const eligibleIds = new Set(
      schedule.eligible.map(unit => getId(unit))
    );

    for (const unit of matchingUnits) {
      if (
        unit.isRetired === true ||
        !eligibleIds.has(getId(unit))
      ) {
        throw new Error(
          `${unit.equipmentId} is unavailable, reserved or under repair ` +
          'during the requested booking period'
        );
      }
    }

    if (allocation.quantity > schedule.available) {
      throw new Error(
        'Not enough equipment is available during ' +
        'the requested booking period'
      );
    }
  }

  return units;
}

// =====================================================
// SAVE INDIVIDUAL EQUIPMENT ASSIGNMENTS
// =====================================================

async function assignUnits(booking, units, update) {
  const allocations =
    update.approvedEquipment?.length
      ? update.approvedEquipment
      : getAllocations(booking);

  await validateUnits(
    allocations,
    units.map(unit => getId(unit)),
    booking
  );

  const updated = await Booking.findOneAndUpdate(
    {
      _id: booking._id,
      status: booking.status,
      'issuedEquipmentItems.0': { $exists: false }
    },
    {
      $set: {
        ...update,
        issuedEquipmentItems: units.map(unit => unit._id)
      }
    },
    {
      new: true,
      runValidators: true
    }
  );

  if (!updated) {
    throw new Error(
      'Booking changed during assignment. Refresh and try again.'
    );
  }

  return updated;
}

// =====================================================
// APPROVE BOOKING
// =====================================================

router.patch('/bookings/:id/approve', async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({
        message: 'Invalid booking ID'
      });
    }

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        message: 'Booking not found'
      });
    }

    if (booking.status !== 'Pending') {
      return res.status(400).json({
        message: 'Only pending bookings can be approved'
      });
    }

    const equipmentOnly = isEquipmentBooking(booking);

    if (equipmentOnly) {
      const requester = booking.user
        ? await User.findById(booking.user)
        : await User.findOne({
            email: booking.studentEmail
          });

      if (
        !requester ||
        requester.role !== 'staff' ||
        requester.staffRequested ||
        requester.staffVerificationStatus === 'rejected'
      ) {
        return res.status(403).json({
          message:
            'Equipment-only bookings require a verified staff requester'
        });
      }
    }

    const availability = await getAvailability(booking);

    if (!equipmentOnly && !availability.labAvailable) {
      return res.status(409).json({
        message:
          'Cannot approve: laboratory is already booked for this time'
      });
    }

    if (
      req.body?.approvedEquipment !== undefined &&
      !Array.isArray(req.body.approvedEquipment)
    ) {
      return res.status(400).json({
        message: 'Invalid approved equipment list'
      });
    }

    const submitted = req.body?.approvedEquipment;

    if (submitted) {
      const requestedIds = new Set(
        availability.equipment.map(item =>
          getId(item.equipmentId)
        )
      );

      const submittedIds = submitted.map(item =>
        getId(item.equipmentId)
      );

      if (
        submittedIds.some(id => !requestedIds.has(id)) ||
        new Set(submittedIds).size !== submittedIds.length
      ) {
        return res.status(400).json({
          message:
            'Approved equipment contains duplicate or unrequested items'
        });
      }
    }

    const approvedEquipment = [];
    const shortages = [];

    for (const item of availability.equipment) {
      const selected = submitted?.find(x =>
        same(x.equipmentId, item.equipmentId)
      );

      const quantity = selected
        ? selected.quantity
        : item.maximumAllocation;

      if (
        !Number.isInteger(quantity) ||
        quantity < 0 ||
        quantity > item.maximumAllocation
      ) {
        return res.status(400).json({
          message:
            `Invalid allocation for ${item.name}. ` +
            `Maximum: ${item.maximumAllocation}`
        });
      }

      approvedEquipment.push({
        equipmentId: item.equipmentId,
        quantity
      });

      if (quantity < item.requested) {
        shortages.push(
          `${item.name}: requested ${item.requested}, ` +
          `allocated ${quantity}`
        );
      }
    }

    const totalAllocated = approvedEquipment.reduce(
      (sum, item) => sum + item.quantity,
      0
    );

    if (equipmentOnly && totalAllocated === 0) {
      return res.status(400).json({
        message:
          'Allocate at least one equipment unit before approving ' +
          'an equipment-only booking'
      });
    }

    const units = await validateUnits(
      approvedEquipment,
      req.body?.issuedEquipmentItems,
      booking
    );

    const comment = String(
      req.body?.adminComment || ''
    ).trim();

    const shortageText = shortages.length
      ? `Equipment availability: ${shortages.join('; ')}`
      : '';

    const adminComment = [
      comment,
      shortageText
    ].filter(Boolean).join('\n');

    const updated = await assignUnits(
      booking,
      units,
      {
        status: 'Approved',
        statusChangedAt: new Date(),
        approvedEquipment,
        adminComment,
        equipmentNeedsAttention: false,
        affectedEquipmentItems: []
      }
    );

    await populateBookingDocument(updated);

    res.json({
      message: shortages.length
        ? equipmentOnly
          ? 'Equipment booking approved with reduced quantities'
          : 'Laboratory approved with reduced equipment quantities'
        : equipmentOnly
          ? 'Equipment booking approved successfully'
          : 'Booking approved successfully',
      booking: updated
    });
  } catch (error) {
    console.error('Approval error:', error);

    res.status(400).json({
      message: error.message || 'Approval failed'
    });
  }
});

// =====================================================
// ASSIGN IDS TO OLDER APPROVED BOOKINGS
// =====================================================

router.patch(
  '/bookings/:id/assign-equipment-items',
  async (req, res) => {
    try {
      if (!validId(req.params.id)) {
        return res.status(400).json({
          message: 'Invalid booking ID'
        });
      }

      const booking = await Booking.findById(
        req.params.id
      );

      if (!booking) {
        return res.status(404).json({
          message: 'Booking not found'
        });
      }

      if (booking.status !== 'Approved') {
        return res.status(400).json({
          message:
            'Only approved bookings can receive individual IDs'
        });
      }

      if (booking.issuedEquipmentItems?.length) {
        return res.status(409).json({
          message:
            'This booking already has assigned equipment IDs'
        });
      }

      const allocations = getAllocations(booking);

      const units = await validateUnits(
        allocations,
        req.body?.issuedEquipmentItems,
        booking
      );

      const updated = await assignUnits(
        booking,
        units,
        {}
      );

      await populateBookingDocument(updated);

      res.json({
        message:
          'Individual equipment IDs assigned successfully',
        booking: updated
      });
    } catch (error) {
      console.error('Assign IDs error:', error);

      res.status(400).json({
        message: error.message || 'Assignment failed'
      });
    }
  }
);

// =====================================================
// GET REPLACEMENT OPTIONS FOR RETIRED EQUIPMENT
// =====================================================

router.get(
  '/bookings/:id/replacement-options/:itemId',
  async (req, res) => {
    try {
      const { id, itemId } = req.params;

      if (!validId(id) || !validId(itemId)) {
        return res.status(400).json({
          message: 'Invalid booking or equipment unit ID'
        });
      }

      const booking = await Booking.findById(id);

      if (!booking) {
        return res.status(404).json({
          message: 'Booking not found'
        });
      }

      if (booking.status !== 'Approved') {
        return res.status(409).json({
          message: 'Only approved bookings can be reassigned'
        });
      }

      if (isPastBooking(booking)) {
        return res.status(409).json({
          message: 'Past bookings cannot be reassigned'
        });
      }

      const assignedIds = getAssignedIds(booking);

      if (!assignedIds.includes(itemId)) {
        return res.status(409).json({
          message: 'This unit is not assigned to the booking'
        });
      }

      const retiredUnit = await EquipmentItem.findById(itemId);

      if (!retiredUnit) {
        return res.status(404).json({
          message: 'Assigned equipment unit not found'
        });
      }

      if (
        retiredUnit.isRetired !== true ||
        retiredUnit.status !== 'Unavailable'
      ) {
        return res.status(409).json({
          message: 'This equipment unit is not retired'
        });
      }

      const equipment = await Equipment.findById(
        retiredUnit.equipment
      );

      if (!equipment || !equipment.isAvailable) {
        return res.json({
          equipment: null,
          retiredUnit: {
            _id: retiredUnit._id,
            equipmentId: retiredUnit.equipmentId
          },
          replacements: []
        });
      }

      if (
        !isEquipmentBooking(booking) &&
        !same(equipment.lab, booking.lab)
      ) {
        return res.status(409).json({
          message: 'Equipment does not belong to this laboratory'
        });
      }

      const schedule = await getScheduleForBooking(
        booking,
        equipment._id
      );

      const replacements = schedule.available > 0
        ? schedule.eligible
            .filter(unit =>
              !assignedIds.includes(getId(unit)) &&
              unit.isRetired !== true &&
              unit.status === 'Available' &&
              !unit.issuedTo
            )
            .sort((a, b) =>
              String(a.equipmentId).localeCompare(
                String(b.equipmentId)
              )
            )
            .map(unit => ({
              _id: unit._id,
              equipmentId: unit.equipmentId
            }))
        : [];

      return res.json({
        equipment: {
          _id: equipment._id,
          name: equipment.name,
          code: equipment.code
        },
        retiredUnit: {
          _id: retiredUnit._id,
          equipmentId: retiredUnit.equipmentId
        },
        replacements
      });
    } catch (error) {
      console.error('Replacement options error:', error);

      return res.status(500).json({
        message: 'Failed to load replacement equipment'
      });
    }
  }
);

// =====================================================
// MANUALLY REASSIGN RETIRED EQUIPMENT
// =====================================================

router.patch(
  '/bookings/:id/reassign-equipment',
  async (req, res) => {
    try {
      const bookingId = req.params.id;

      const {
        retiredItemId,
        replacementItemId
      } = req.body || {};

      if (
        !validId(bookingId) ||
        !validId(retiredItemId) ||
        !validId(replacementItemId)
      ) {
        return res.status(400).json({
          message: 'Invalid booking or equipment unit ID'
        });
      }

      if (same(retiredItemId, replacementItemId)) {
        return res.status(400).json({
          message: 'Select a different replacement unit'
        });
      }

      const booking = await Booking.findById(bookingId);

      if (!booking) {
        return res.status(404).json({
          message: 'Booking not found'
        });
      }

      if (booking.status !== 'Approved') {
        return res.status(409).json({
          message: 'Only approved bookings can be reassigned'
        });
      }

      if (isPastBooking(booking)) {
        return res.status(409).json({
          message: 'Past bookings cannot be reassigned'
        });
      }

      const assignedIds = getAssignedIds(booking);

      if (!assignedIds.includes(getId(retiredItemId))) {
        return res.status(409).json({
          message:
            'The retired unit is no longer assigned to this booking'
        });
      }

      if (assignedIds.includes(getId(replacementItemId))) {
        return res.status(409).json({
          message:
            'The replacement unit is already assigned to this booking'
        });
      }

      const [retiredUnit, replacementUnit] = await Promise.all([
        EquipmentItem.findById(retiredItemId),
        EquipmentItem.findById(replacementItemId)
      ]);

      if (!retiredUnit || !replacementUnit) {
        return res.status(404).json({
          message: 'Equipment unit not found'
        });
      }

      if (
        retiredUnit.isRetired !== true ||
        retiredUnit.status !== 'Unavailable'
      ) {
        return res.status(409).json({
          message: 'The original unit is not retired'
        });
      }

      if (!same(retiredUnit.equipment, replacementUnit.equipment)) {
        return res.status(409).json({
          message:
            'Replacement must belong to the same equipment type'
        });
      }

      if (
        replacementUnit.isRetired === true ||
        replacementUnit.status !== 'Available' ||
        replacementUnit.issuedTo
      ) {
        return res.status(409).json({
          message: 'Selected replacement is unavailable'
        });
      }

      const equipment = await Equipment.findById(
        retiredUnit.equipment
      );

      if (!equipment || !equipment.isAvailable) {
        return res.status(409).json({
          message: 'Equipment type is unavailable'
        });
      }

      if (
        !isEquipmentBooking(booking) &&
        !same(equipment.lab, booking.lab)
      ) {
        return res.status(409).json({
          message:
            'Replacement equipment belongs to another laboratory'
        });
      }

      const schedule = await getScheduleForBooking(
        booking,
        equipment._id
      );

      const eligibleIds = new Set(
        schedule.eligible.map(getId)
      );

      if (
        !eligibleIds.has(getId(replacementItemId)) ||
        schedule.available < 1
      ) {
        return res.status(409).json({
          message:
            'Replacement is reserved or under repair during this booking'
        });
      }

      const updatedIds = assignedIds.map(unitId =>
        same(unitId, retiredItemId)
          ? replacementUnit._id
          : unitId
      );

      // Recheck all remaining assignments for retired units.
      const updatedUnits = await EquipmentItem.find({
        _id: { $in: updatedIds }
      });

      if (updatedUnits.length !== updatedIds.length) {
        return res.status(409).json({
          message:
            'One or more assigned equipment units no longer exist'
        });
      }

      const remainingRetiredIds = updatedUnits
        .filter(unit => unit.isRetired === true)
        .map(unit => unit._id);

      // Update only assignments and warning information.
      // Booking approval, date and time remain unchanged.

      const updated = await Booking.findOneAndUpdate(
        {
          _id: booking._id,
          status: 'Approved',
          issuedEquipmentItems: booking.issuedEquipmentItems,
          affectedEquipmentItems: booking.affectedEquipmentItems,
          equipmentNeedsAttention: booking.equipmentNeedsAttention
        },
        {
          $set: {
            issuedEquipmentItems: updatedIds,
            affectedEquipmentItems: remainingRetiredIds,
            equipmentNeedsAttention:
              remainingRetiredIds.length > 0
          }
        },
        {
          new: true,
          runValidators: true
        }
      );

      if (!updated) {
        return res.status(409).json({
          message:
            'Booking changed during reassignment. Refresh and try again.'
        });
      }

      await populateBookingDocument(updated);

      return res.json({
        message: 'Equipment reassigned successfully',
        booking: updated
      });
    } catch (error) {
      console.error('Reassign equipment error:', error);

      return res.status(500).json({
        message: 'Failed to reassign equipment'
      });
    }
  }
);

// =====================================================
// REJECT PENDING BOOKING
// =====================================================

router.patch('/bookings/:id/reject', async (req, res) => {
  try {
    const reason = req.body?.rejectionReason;

    if (
      typeof reason !== 'string' ||
      !reason.trim()
    ) {
      return res.status(400).json({
        message: 'Please provide a rejection reason'
      });
    }

    if (!validId(req.params.id)) {
      return res.status(400).json({
        message: 'Invalid booking ID'
      });
    }

    const booking = await Booking.findOneAndUpdate(
      {
        _id: req.params.id,
        status: 'Pending'
      },
      {
        $set: {
          status: 'Rejected',
          statusChangedAt: new Date(),
          rejectionReason: reason.trim()
        }
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!booking) {
      return res.status(404).json({
        message:
          'Pending booking not found or already processed'
      });
    }

    res.json({
      message: 'Booking rejected successfully',
      booking
    });
  } catch (error) {
    console.error('Reject booking error:', error);

    res.status(500).json({
      message: 'Failed to reject booking'
    });
  }
});

// =====================================================
// ADMIN CANCELS APPROVED BOOKING
// =====================================================

router.patch('/bookings/:id/cancel', async (req, res) => {
  try {
    const reason = req.body?.cancellationReason;

    if (
      typeof reason !== 'string' ||
      !reason.trim()
    ) {
      return res.status(400).json({
        message: 'Please provide a cancellation reason'
      });
    }

    if (!validId(req.params.id)) {
      return res.status(400).json({
        message: 'Invalid booking ID'
      });
    }

    const booking = await Booking.findOneAndUpdate(
      {
        _id: req.params.id,
        status: 'Approved'
      },
      {
        $set: {
          status: 'Cancelled',
          statusChangedAt: new Date(),
          cancellationReason: reason.trim(),
          cancellationRequestedBy: 'admin',
          equipmentNeedsAttention: false,
          affectedEquipmentItems: []
        }
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!booking) {
      return res.status(404).json({
        message:
          'Approved booking not found or already cancelled'
      });
    }

    // Cancellation releases the date-based reservation.
    // Only clean up old permanent Issued statuses if
    // no other active booking references the unit.
    // Never reactivate retired equipment.

    if (booking.issuedEquipmentItems?.length) {
      const assignedIds =
        booking.issuedEquipmentItems.map(getId);

      for (const unitId of assignedIds) {
        const otherBooking = await Booking.exists({
          _id: { $ne: booking._id },
          status: { $in: ACTIVE_STATUSES },
          issuedEquipmentItems: unitId
        });

        if (!otherBooking) {
          await EquipmentItem.updateOne(
            {
              _id: unitId,
              status: 'Issued',
              isRetired: { $ne: true }
            },
            {
              $set: {
                status: 'Available',
                issuedTo: null
              }
            }
          );
        }
      }
    }

    await populateBookingDocument(booking);

    res.json({
      message: isEquipmentBooking(booking)
        ? 'Equipment booking cancelled successfully by administrator'
        : 'Booking cancelled successfully by administrator',
      booking
    });
  } catch (error) {
    console.error('Admin cancellation error:', error);

    res.status(500).json({
      message: 'Unable to cancel booking'
    });
  }
});

// =====================================================
// USER MANAGEMENT
// =====================================================

router.get('/users', async (req, res) => {
  try {
    const users = await User.find()
      .select(
        'name email telephoneNumber registrationNo batch ' +
        'role staffRequested staffVerificationStatus createdAt'
      )
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (error) {
    console.error('Load users error:', error);

    res.status(500).json({
      message: 'Failed to load registered users'
    });
  }
});

module.exports = router;