const express = require('express');
const mongoose = require('mongoose');

const Equipment = require('../models/Equipment');
const EquipmentItem = require('../models/EquipmentItem');
const Booking = require('../models/Booking');
const Lab = require('../models/Lab');
const EquipmentRepair = require('../models/EquipmentRepair');

const {
  dateKey,
  getRepairConflicts
} = require('../services/equipmentSchedule');

const generateEquipmentIds = require('../utils/generateEquipmentIds');

const protect = require('../middleware/authMiddleware');
const adminOnly = require('../middleware/adminMiddleware');

const router = express.Router();

const validCode = code =>
  typeof code === 'string' &&
  /^[A-Z]{2,6}$/.test(code.trim().toUpperCase());

const validId = id => mongoose.isValidObjectId(id);

// ======================================================
// INVENTORY STATISTICS
// ======================================================

const getInventoryStats = async equipmentId => {
  const items = await EquipmentItem.find({
    equipment: equipmentId
  }).lean();

  const today = new Date()
    .toISOString()
    .slice(0, 10);

  const repairs = await EquipmentRepair.find({
    equipment: equipmentId,
    startDate: { $lte: today },
    endDate: { $gte: today },
    completedAt: null
  }).lean();

  const repairIds = new Set(
    repairs.map(repair =>
      String(repair.equipmentItem)
    )
  );

  const underRepair = items.filter(item =>
    (item.status === 'Under Repair' ||
      repairIds.has(String(item._id))) &&
    item.status !== 'Unavailable' &&
    item.isRetired !== true
  ).length;

  const unavailable = items.filter(
    item =>
      item.status === 'Unavailable' ||
      item.isRetired === true
  ).length;

  return {
    totalQuantity: items.length,
    usableQuantity:
      items.length - underRepair - unavailable,
    underRepairQuantity: underRepair,
    unavailableQuantity: unavailable,
    issuedQuantity: 0,
    availableQuantity:
      items.length - underRepair - unavailable
  };
};

// ======================================================
// GET ALL EQUIPMENT
// ======================================================

router.get('/', async (req, res) => {
  try {
    const equipment = await Equipment.find()
      .populate('lab', 'name')
      .sort({ name: 1 });

    const results = await Promise.all(
      equipment.map(async item => {
        const stats = await getInventoryStats(item._id);

        return {
          ...item.toObject(),
          ...stats
        };
      })
    );

    res.status(200).json(results);
  } catch (error) {
    console.error('Get equipment error:', error);

    res.status(500).json({
      message: 'Failed to load equipment'
    });
  }
});

// ======================================================
// GET INDIVIDUAL EQUIPMENT UNITS
// ======================================================

router.get(
  '/:id/items',
  protect,
  adminOnly,
  async (req, res) => {
    try {
      if (!validId(req.params.id)) {
        return res.status(400).json({
          message: 'Invalid equipment ID'
        });
      }

      const equipment = await Equipment.findById(
        req.params.id
      );

      if (!equipment) {
        return res.status(404).json({
          message: 'Equipment not found'
        });
      }

      const items = await EquipmentItem.find({
        equipment: equipment._id
      })
        .select(
          'equipmentId status issuedTo isRetired retiredAt retirementReason createdAt'
        )
        .sort({ equipmentId: 1 });

      const repairs = await EquipmentRepair.find({
        equipment: equipment._id
      })
        .sort({ startDate: 1 })
        .lean();

      const today = new Date()
        .toISOString()
        .slice(0, 10);

      res.json({
        equipment: {
          _id: equipment._id,
          name: equipment.name,
          code: equipment.code
        },

        items: items.map(item => ({
          ...item.toObject(),

          repairPeriods: repairs.filter(
            repair =>
              String(repair.equipmentItem) ===
              String(item._id)
          ),

          displayStatus:
            item.isRetired === true
              ? 'Retired'
              : item.status === 'Unavailable'
              ? 'Unavailable'
              : item.status === 'Under Repair' ||
                repairs.some(
                  repair =>
                    String(repair.equipmentItem) ===
                      String(item._id) &&
                    !repair.completedAt &&
                    repair.startDate <= today &&
                    repair.endDate >= today
                )
              ? 'Under Repair'
              : 'Usable'
        }))
      });
    } catch (error) {
      console.error(
        'Get equipment items error:',
        error
      );

      res.status(500).json({
        message: 'Failed to load equipment IDs'
      });
    }
  }
);

// ======================================================
// PERMANENTLY RETIRE A PHYSICAL EQUIPMENT UNIT
// ======================================================

router.patch(
  '/:id/items/:itemId/retire',
  protect,
  adminOnly,
  async (req, res) => {
    try {
      const { id, itemId } = req.params;

      if (!validId(id) || !validId(itemId)) {
        return res.status(400).json({
          message: 'Invalid equipment ID.'
        });
      }

      const reason = req.body?.reason;

      if (
        typeof reason !== 'string' ||
        !reason.trim()
      ) {
        return res.status(400).json({
          message:
            'Provide a reason for retiring this equipment unit.'
        });
      }

      if (reason.trim().length > 1000) {
        return res.status(400).json({
          message:
            'Retirement reason must be 1000 characters or fewer.'
        });
      }

      const unit = await EquipmentItem.findOne({
        _id: itemId,
        equipment: id
      });

      if (!unit) {
        return res.status(404).json({
          message: 'Equipment unit not found.'
        });
      }

      if (unit.isRetired === true) {
        return res.status(409).json({
          message: 'This unit is already retired.'
        });
      }

      if (
        unit.status === 'Issued' ||
        unit.issuedTo
      ) {
        return res.status(409).json({
          message:
            'This unit is currently issued. Resolve its issue/return record before retirement.'
        });
      }

      const now = new Date();

      const updated =
        await EquipmentItem.findOneAndUpdate(
          {
            _id: unit._id,
            equipment: id,
            isRetired: { $ne: true },
            status: { $ne: 'Issued' },
            issuedTo: null
          },
          {
            $set: {
              status: 'Unavailable',
              isRetired: true,
              retiredAt: now,
              retirementReason: reason.trim()
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
            'Unit changed during retirement. Refresh and try again.'
        });
      }

      // Preserve booking status, dates and assignments.
      // Flag future approved bookings using this physical unit.

      const today = now.toISOString().slice(0, 10);

      const affected = await Booking.find({
        status: 'Approved',
        bookingDate: {
          $gte: new Date(`${today}T00:00:00.000Z`)
        },
        issuedEquipmentItems: updated._id
      }).select('_id');

      const affectedIds = affected.map(
        booking => booking._id
      );

      if (affectedIds.length) {
        await Booking.updateMany(
          {
            _id: {
              $in: affectedIds
            }
          },
          {
            $set: {
              equipmentNeedsAttention: true
            },
            $addToSet: {
              affectedEquipmentItems: updated._id
            }
          }
        );
      }

      return res.json({
        message:
          'Equipment unit retired successfully.',
        item: updated,
        affectedBookings: affectedIds.length
      });
    } catch (error) {
      console.error(
        'Retire equipment unit error:',
        error
      );

      return res.status(500).json({
        message:
          'Failed to retire equipment unit.'
      });
    }
  }
);

// ======================================================
// DATE VALIDATION
// ======================================================

const validDate = value =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(
    Date.parse(value + 'T00:00:00Z')
  ) &&
  new Date(value + 'T00:00:00Z')
    .toISOString()
    .slice(0, 10) === value;

// ======================================================
// SCHEDULE A REPAIR
// ======================================================

router.post(
  '/:id/items/:itemId/repairs',
  protect,
  adminOnly,
  async (req, res) => {
    try {
      const { id, itemId } = req.params;

      const {
        startDate,
        endDate,
        notes = ''
      } = req.body;

      if (
        !validId(id) ||
        !validId(itemId) ||
        !validDate(startDate) ||
        !validDate(endDate) ||
        endDate < startDate
      ) {
        return res.status(400).json({
          message:
            'Enter valid start and end dates (YYYY-MM-DD).'
        });
      }

      const item = await EquipmentItem.findOne({
        _id: itemId,
        equipment: id
      });

      if (!item) {
        return res.status(404).json({
          message: 'Equipment unit not found.'
        });
      }

      if (
        item.status === 'Unavailable' ||
        item.isRetired === true
      ) {
        return res.status(409).json({
          message:
            'Unavailable equipment requires review.'
        });
      }

      // Prevent overlapping repair periods.

      const overlaps = await EquipmentRepair.exists({
        equipmentItem: itemId,
        completedAt: null,
        startDate: { $lte: endDate },
        endDate: { $gte: startDate }
      });

      if (overlaps) {
        return res.status(409).json({
          message:
            'This equipment already has an overlapping repair period.'
        });
      }

      // Prevent repairs conflicting with approved bookings.

      const conflicts = await getRepairConflicts(
        itemId,
        startDate,
        endDate
      );

      if (conflicts.length) {
        return res.status(409).json({
          message:
            'Cannot schedule repair: this equipment is already assigned to an approved booking during these dates. Cancel or reassign the conflicting booking first.'
        });
      }

      // Check older approved bookings without physical IDs.

      const undatedBookings = await Booking.find({
        status: {
          $in: [
            'Approved',
            'Cancellation Requested'
          ]
        },
        'issuedEquipmentItems.0': {
          $exists: false
        }
      }).lean();

      const conflictingLegacy =
        undatedBookings.some(booking => {
          const date = dateKey(
            booking.bookingDate
          );

          const allocations =
            booking.approvedEquipment?.length
              ? booking.approvedEquipment
              : booking.equipment || [];

          return (
            date >= startDate &&
            date <= endDate &&
            allocations.some(
              allocation =>
                String(allocation.equipmentId) ===
                  String(id) &&
                allocation.quantity > 0
            )
          );
        });

      if (conflictingLegacy) {
        return res.status(409).json({
          message:
            'An older approved booking without assigned physical IDs uses this equipment during the repair dates. Assign its IDs first.'
        });
      }

      const repair = await EquipmentRepair.create({
        equipment: id,
        equipmentItem: itemId,
        startDate,
        endDate,
        notes: String(notes).trim()
      });

      return res.status(201).json({
        message:
          'Repair period scheduled successfully.',
        repair
      });
    } catch (error) {
      console.error(
        'Schedule repair error:',
        error
      );

      return res.status(500).json({
        message:
          'Failed to schedule repair.'
      });
    }
  }
);

// ======================================================
// MARK REPAIR COMPLETED
// ======================================================

router.patch(
  '/:id/items/:itemId/repairs/:repairId/complete',
  protect,
  adminOnly,
  async (req, res) => {
    try {
      const {
        id,
        itemId,
        repairId
      } = req.params;

      if (
        ![id, itemId, repairId].every(validId)
      ) {
        return res.status(400).json({
          message: 'Invalid ID.'
        });
      }

      const repair =
        await EquipmentRepair.findOneAndUpdate(
          {
            _id: repairId,
            equipment: id,
            equipmentItem: itemId,
            completedAt: null
          },
          {
            $set: {
              completedAt: new Date()
            }
          },
          {
            new: true
          }
        );

      if (!repair) {
        return res.status(404).json({
          message:
            'Active repair period not found.'
        });
      }

      return res.json({
        message:
          'Repair marked completed. The unit can be booked outside any remaining repair periods.',
        repair
      });
    } catch (error) {
      console.error(
        'Complete repair error:',
        error
      );

      return res.status(500).json({
        message:
          'Failed to complete repair.'
      });
    }
  }
);

// ======================================================
// LEGACY REPAIR STATUS COMPATIBILITY
// ======================================================

// Only clears an old Under Repair status that was
// stored without a repair schedule.

router.patch(
  '/:id/items/:itemId/status',
  protect,
  adminOnly,
  async (req, res) => {
    try {
      if (
        req.body?.status !== 'Available' ||
        !validId(req.params.id) ||
        !validId(req.params.itemId)
      ) {
        return res.status(400).json({
          message:
            'Schedule repairs using dates. This endpoint only clears an old undated repair status.'
        });
      }

      const item =
        await EquipmentItem.findOneAndUpdate(
          {
            _id: req.params.itemId,
            equipment: req.params.id,
            status: 'Under Repair',
            isRetired: { $ne: true }
          },
          {
            $set: {
              status: 'Available',
              issuedTo: null
            }
          },
          {
            new: true
          }
        );

      if (!item) {
        return res.status(409).json({
          message:
            'Legacy repair status not found.'
        });
      }

      res.json({
        message:
          'Old undated repair status cleared.',
        item
      });
    } catch (error) {
      res.status(500).json({
        message:
          'Failed to clear legacy repair status.'
      });
    }
  }
);

// ======================================================
// ADD EQUIPMENT OR INCREASE QUANTITY
// ======================================================

router.post(
  '/',
  protect,
  adminOnly,
  async (req, res) => {
    try {
      const {
        name,
        code,
        description,
        lab,
        totalQuantity
      } = req.body;

      const cleanName = String(
        name || ''
      ).trim();

      const cleanCode = String(
        code || ''
      ).trim().toUpperCase();

      const quantity = Number(totalQuantity);

      if (
        !cleanName ||
        !validCode(cleanCode)
      ) {
        return res.status(400).json({
          message:
            'Enter a valid equipment name and code'
        });
      }

      if (
        !Number.isInteger(quantity) ||
        quantity <= 0
      ) {
        return res.status(400).json({
          message:
            'Quantity must be greater than zero'
        });
      }

      if (!validId(lab)) {
        return res.status(400).json({
          message:
            'Please select a valid laboratory'
        });
      }

      const selectedLab =
        await Lab.findById(lab);

      if (!selectedLab) {
        return res.status(404).json({
          message:
            'Selected laboratory does not exist'
        });
      }

      const existing =
        await Equipment.findOne({
          code: cleanCode,
          lab: selectedLab._id
        });

      if (existing) {
        const trackedCount =
          await EquipmentItem.countDocuments({
            equipment: existing._id
          });

        const newTotal =
          Math.max(
            existing.totalQuantity,
            trackedCount
          ) + quantity;

        await generateEquipmentIds(
          existing._id,
          cleanCode,
          newTotal
        );

        existing.totalQuantity = newTotal;

        await existing.save();

        return res.status(200).json({
          message:
            'Equipment quantity increased successfully',
          equipment: existing
        });
      }

      const equipment =
        await Equipment.create({
          name: cleanName,
          code: cleanCode,
          description: description || '',
          lab: selectedLab._id,
          totalQuantity: quantity,
          isAvailable: true
        });

      try {
        await generateEquipmentIds(
          equipment._id,
          cleanCode,
          quantity
        );
      } catch (error) {
        await EquipmentItem.deleteMany({
          equipment: equipment._id
        });

        await Equipment.findByIdAndDelete(
          equipment._id
        );

        throw error;
      }

      return res.status(201).json({
        message:
          'Equipment added successfully',
        equipment
      });
    } catch (error) {
      console.error(
        'Add equipment error:',
        error
      );

      return res.status(500).json({
        message:
          error.message ||
          'Failed to add equipment'
      });
    }
  }
);

// ======================================================
// EDIT EQUIPMENT
// ======================================================

router.put(
  '/:id',
  protect,
  adminOnly,
  async (req, res) => {
    try {
      const {
        name,
        code,
        description,
        lab,
        totalQuantity
      } = req.body;

      if (!validId(req.params.id)) {
        return res.status(400).json({
          message: 'Invalid equipment ID'
        });
      }

      if (
        typeof name !== 'string' ||
        !name.trim() ||
        !validCode(code) ||
        !Number.isInteger(totalQuantity) ||
        totalQuantity < 0
      ) {
        return res.status(400).json({
          message:
            'Enter valid equipment details'
        });
      }

      if (!validId(lab)) {
        return res.status(400).json({
          message:
            'Please select a valid laboratory'
        });
      }

      const selectedLab =
        await Lab.findById(lab);

      if (!selectedLab) {
        return res.status(404).json({
          message:
            'Selected laboratory does not exist'
        });
      }

      const equipment =
        await Equipment.findById(
          req.params.id
        );

      if (!equipment) {
        return res.status(404).json({
          message: 'Equipment not found'
        });
      }

      const cleanCode =
        code.trim().toUpperCase();

      const duplicate =
        await Equipment.findOne({
          _id: { $ne: equipment._id },
          code: cleanCode,
          lab: selectedLab._id
        });

      if (duplicate) {
        return res.status(400).json({
          message:
            'This equipment already exists in the selected laboratory'
        });
      }

      const trackedCount =
        await EquipmentItem.countDocuments({
          equipment: equipment._id
        });

      if (trackedCount > 0) {
        if (equipment.code !== cleanCode) {
          return res.status(400).json({
            message:
              'Equipment code cannot change after IDs are generated'
          });
        }

        if (
          totalQuantity <
            equipment.totalQuantity ||
          totalQuantity < trackedCount
        ) {
          return res.status(400).json({
            message:
              'Cannot reduce tracked equipment quantity using Edit'
          });
        }

        if (
          String(equipment.lab) !==
          String(selectedLab._id)
        ) {
          return res.status(400).json({
            message:
              'Cannot change laboratory for tracked equipment here'
          });
        }
      }

      if (totalQuantity > trackedCount) {
        await generateEquipmentIds(
          equipment._id,
          cleanCode,
          totalQuantity
        );
      }

      equipment.name = name.trim();
      equipment.code = cleanCode;
      equipment.description =
        description || '';
      equipment.lab = selectedLab._id;
      equipment.totalQuantity =
        totalQuantity;

      await equipment.save();

      res.status(200).json({
        message:
          'Equipment updated successfully',
        equipment
      });
    } catch (error) {
      console.error(
        'Update equipment error:',
        error
      );

      res.status(500).json({
        message:
          'Failed to update equipment'
      });
    }
  }
);

// ======================================================
// DELETE EQUIPMENT
// ======================================================

router.delete(
  '/:id',
  protect,
  adminOnly,
  async (req, res) => {
    try {
      if (!validId(req.params.id)) {
        return res.status(400).json({
          message: 'Invalid equipment ID'
        });
      }

      const equipment =
        await Equipment.findById(
          req.params.id
        );

      if (!equipment) {
        return res.status(404).json({
          message: 'Equipment not found'
        });
      }

      // Generated IDs alone are not usage history.

      const units = await EquipmentItem.find({
        equipment: equipment._id
      })
        .select(
          '_id status issuedTo isRetired retiredAt'
        )
        .lean();

      const unitIds = units.map(
        unit => unit._id
      );

      const usedInBooking = await Booking.exists({
        $or: [
          {
            'equipment.equipmentId':
              equipment._id
          },
          {
            'approvedEquipment.equipmentId':
              equipment._id
          },
          {
            issuedEquipmentItems: {
              $in: unitIds
            }
          },
          {
            affectedEquipmentItems: {
              $in: unitIds
            }
          }
        ]
      });

      if (usedInBooking) {
        return res.status(409).json({
          message:
            'Cannot delete equipment referenced by booking history.'
        });
      }

      const repairHistory =
        await EquipmentRepair.exists({
          $or: [
            {
              equipment: equipment._id
            },
            {
              equipmentItem: {
                $in: unitIds
              }
            }
          ]
        });

      if (repairHistory) {
        return res.status(409).json({
          message:
            'Cannot delete equipment with repair history.'
        });
      }

      if (
        units.some(
          unit =>
            unit.isRetired === true ||
            unit.retiredAt ||
            unit.issuedTo ||
            unit.status !== 'Available'
        )
      ) {
        return res.status(409).json({
          message:
            'Cannot delete equipment with retirement, issue or unavailable-unit history.'
        });
      }

      // Delete unused generated IDs and their parent equipment.

      await EquipmentItem.deleteMany({
        equipment: equipment._id
      });

      await Equipment.findByIdAndDelete(
        equipment._id
      );

      res.status(200).json({
        message:
          'Equipment deleted successfully'
      });
    } catch (error) {
      console.error(
        'Delete equipment error:',
        error
      );

      res.status(500).json({
        message:
          'Failed to delete equipment'
      });
    }
  }
);

module.exports = router;