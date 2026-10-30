
const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

const Booking = require('../models/Booking');
const Lab = require('../models/Lab');
const Equipment = require('../models/Equipment');
const EquipmentItem = require('../models/EquipmentItem');
const User = require('../models/User');

const protect = require('../middleware/authMiddleware');
const cancelBooking = require('../services/cancelBooking');

const UNDERGRADUATE_LAB_NAME =
  'Undergraduate Project Lab';

// Staff bookings for other laboratories:
// 8:30 AM to 4:30 PM.
const STAFF_LAB_OPEN_TIME = '08:30';
const STAFF_LAB_CLOSE_TIME = '16:30';

// ======================================================
// HELPERS
// ======================================================

const normalizeLabName = name =>
  String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

const sameId = (a, b) =>
  String(a?._id || a) === String(b?._id || b);

const validId = id =>
  mongoose.isValidObjectId(id);

const validTime = value =>
  typeof value === 'string' &&
  /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

const validDate = value => {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const parsed = new Date(
    `${value}T00:00:00.000Z`
  );

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
};

const getColomboToday = () => {
  const parts = new Intl.DateTimeFormat(
    'en-CA',
    {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }
  ).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map(part => [
      part.type,
      part.value
    ])
  );

  return (
    `${values.year}-` +
    `${values.month}-` +
    `${values.day}`
  );
};

// ======================================================
// POPULATE BOOKING DETAILS
// ======================================================

const bookingPopulateOptions = [
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
    select: 'equipmentId equipment status'
  }
];

const populateBooking = query =>
  query.populate(bookingPopulateOptions);

// ======================================================
// CREATE LABORATORY OR EQUIPMENT-ONLY BOOKING
// POST /api/bookings
// ======================================================

router.post(
  '/',
  protect,
  async (req, res) => {
    try {
      const {
        bookingType = 'lab',
        lab,
        bookingDate,
        startTime,
        endTime,
        purpose,
        equipment = []
      } = req.body || {};

      // ------------------------------------------------
      // AUTHENTICATE REQUESTER
      // ------------------------------------------------

      const user = await User.findById(
        req.userId
      );

      if (!user) {
        return res.status(401).json({
          message: 'User account not found'
        });
      }

      if (
        user.staffRequested ||
        (
          user.role === 'staff' &&
          user.staffVerificationStatus === 'rejected'
        )
      ) {
        return res.status(403).json({
          message:
            'Your staff verification is not complete'
        });
      }

      if (
        !['student', 'staff'].includes(user.role)
      ) {
        return res.status(403).json({
          message:
            'You are not allowed to create bookings'
        });
      }

      // ------------------------------------------------
      // VALIDATE BOOKING TYPE
      // ------------------------------------------------

      if (
        !['lab', 'equipment'].includes(bookingType)
      ) {
        return res.status(400).json({
          message: 'Invalid booking type'
        });
      }

      if (
        bookingType === 'equipment' &&
        user.role !== 'staff'
      ) {
        return res.status(403).json({
          message:
            'Only verified staff can create equipment-only bookings'
        });
      }

      // ------------------------------------------------
      // VALIDATE REQUIRED FIELDS
      // ------------------------------------------------

      if (
        (bookingType === 'lab' && !lab) ||
        !bookingDate ||
        !startTime ||
        !endTime ||
        typeof purpose !== 'string' ||
        !purpose.trim()
      ) {
        return res.status(400).json({
          message:
            'Please complete all required booking fields'
        });
      }

      if (!validDate(bookingDate)) {
        return res.status(400).json({
          message: 'Invalid booking date'
        });
      }

      if (bookingDate < getColomboToday()) {
        return res.status(400).json({
          message:
            'Cannot create bookings for past dates'
        });
      }

      if (
        !validTime(startTime) ||
        !validTime(endTime)
      ) {
        return res.status(400).json({
          message: 'Time must use HH:MM format'
        });
      }

      if (startTime >= endTime) {
        return res.status(400).json({
          message:
            'End time must be after start time'
        });
      }

      if (!Array.isArray(equipment)) {
        return res.status(400).json({
          message: 'Invalid equipment list'
        });
      }

      if (
        bookingType === 'equipment' &&
        equipment.length === 0
      ) {
        return res.status(400).json({
          message:
            'Please select at least one equipment item'
        });
      }

      const selectedDate = new Date(
        `${bookingDate}T00:00:00.000Z`
      );

      // ------------------------------------------------
      // VALIDATE LABORATORY BOOKING
      // ------------------------------------------------

      let selectedLab = null;

      if (bookingType === 'lab') {
        if (!validId(lab)) {
          return res.status(400).json({
            message: 'Invalid laboratory ID'
          });
        }

        selectedLab = await Lab.findById(lab);

        if (!selectedLab) {
          return res.status(404).json({
            message: 'Laboratory not found'
          });
        }

        const isUndergraduateLab =
          normalizeLabName(selectedLab.name) ===
          normalizeLabName(
            UNDERGRADUATE_LAB_NAME
          );

        // Students can book only the
        // Undergraduate Project Lab.

        if (
          user.role === 'student' &&
          !isUndergraduateLab
        ) {
          return res.status(403).json({
            message:
              'Students can book only the Undergraduate Project Lab'
          });
        }

        if (!selectedLab.isAvailable) {
          return res.status(400).json({
            message:
              'This laboratory is unavailable'
          });
        }

        // ------------------------------------------------
        // NEW: STAFF LABORATORY BOOKING HOURS
        // ------------------------------------------------
        //
        // Undergraduate Project Lab:
        // Students and staff can book 24/7.
        //
        // Other laboratories:
        // Staff can book only 08:30 to 16:30.
        //
        // Equipment-only bookings are not affected.

        if (
          user.role === 'staff' &&
          !isUndergraduateLab
        ) {
          if (
            startTime < STAFF_LAB_OPEN_TIME ||
            endTime > STAFF_LAB_CLOSE_TIME
          ) {
            return res.status(400).json({
              message:
                'Staff bookings for this laboratory ' +
                'must be between 8:30 AM and 4:30 PM.'
            });
          }
        }

        // ------------------------------------------------
        // CHECK LABORATORY CONFLICTS
        // ------------------------------------------------
        //
        // Equipment-only bookings do not
        // reserve laboratory space.

        const conflictingLabBooking =
          await Booking.findOne({
            lab: selectedLab._id,
            bookingDate: selectedDate,

            status: {
              $in: [
                'Approved',
                'Cancellation Requested'
              ]
            },

            bookingType: {
              $ne: 'equipment'
            },

            startTime: {
              $lt: endTime
            },

            endTime: {
              $gt: startTime
            }
          });

        if (conflictingLabBooking) {
          return res.status(409).json({
            message:
              'This laboratory is already booked for the selected time'
          });
        }
      }

      // ------------------------------------------------
      // VALIDATE REQUESTED EQUIPMENT
      // ------------------------------------------------

      const validatedEquipment = [];
      const seenEquipmentIds = new Set();

      for (const requested of equipment) {
        if (
          !requested ||
          !validId(requested.equipmentId)
        ) {
          return res.status(400).json({
            message: 'Invalid equipment ID'
          });
        }

        const equipmentId = String(
          requested.equipmentId
        );

        if (
          seenEquipmentIds.has(equipmentId)
        ) {
          return res.status(400).json({
            message:
              'The same equipment type cannot be added twice'
          });
        }

        seenEquipmentIds.add(equipmentId);

        if (
          !Number.isInteger(requested.quantity) ||
          requested.quantity < 1
        ) {
          return res.status(400).json({
            message:
              'Equipment quantity must be a positive whole number'
          });
        }

        const record = await Equipment.findById(
          equipmentId
        );

        if (!record) {
          return res.status(404).json({
            message:
              'Requested equipment not found'
          });
        }

        if (!record.isAvailable) {
          return res.status(400).json({
            message:
              `${record.name} is currently unavailable`
          });
        }

        // Laboratory bookings:
        // Equipment must belong to the selected lab.
        //
        // Equipment-only bookings:
        // Equipment may come from multiple labs.

        if (
          bookingType === 'lab' &&
          !sameId(
            record.lab,
            selectedLab._id
          )
        ) {
          return res.status(400).json({
            message:
              `${record.name} does not belong to the selected laboratory`
          });
        }

        const usableCount =
          await EquipmentItem.countDocuments({
            equipment: record._id,
            status: {
              $in: [
                'Available',
                'Issued'
              ]
            }
          });

        if (
          requested.quantity > usableCount
        ) {
          return res.status(400).json({
            message:
              `Requested quantity for ${record.name} ` +
              `exceeds its usable quantity (${usableCount})`
          });
        }

        validatedEquipment.push({
          equipmentId: record._id,
          quantity: requested.quantity
        });
      }

      // ------------------------------------------------
      // SAVE BOOKING REQUEST
      // ------------------------------------------------

      const booking = new Booking({
        bookingType,

        lab:
          bookingType === 'lab'
            ? selectedLab._id
            : null,

        studentName: user.name,
        studentEmail: user.email,

        user: user._id,
        requesterRole: user.role,

        bookingDate: selectedDate,
        startTime,
        endTime,

        purpose: purpose.trim(),

        equipment: validatedEquipment,

        approvedEquipment: [],
        issuedEquipmentItems: [],

        status: 'Pending',
        statusChangedAt: null
      });

      await booking.save();

      await booking.populate(
        bookingPopulateOptions
      );

      return res.status(201).json({
        message:
          bookingType === 'equipment'
            ? 'Equipment booking request submitted successfully'
            : 'Laboratory booking request submitted successfully',

        booking
      });

    } catch (error) {
      console.error(
        'Create booking error:',
        error
      );

      return res.status(500).json({
        message:
          'Failed to create booking request'
      });
    }
  }
);

// ======================================================
// GET MY BOOKINGS
// GET /api/bookings/my-bookings
// ======================================================

router.get(
  '/my-bookings',
  protect,
  async (req, res) => {
    try {
      const user = await User.findById(
        req.userId
      );

      if (!user) {
        return res.status(401).json({
          message: 'User account not found'
        });
      }

      const bookings = await populateBooking(
        Booking.find({
          $or: [
            {
              user: user._id
            },
            {
              studentEmail: user.email
            }
          ]
        }).sort({
          createdAt: -1,
          _id: -1
        })
      );

      const results = bookings.map(
        booking => {
          const result = booking.toObject();

          result.bookingType =
            result.bookingType || 'lab';

          return result;
        }
      );

      return res.json(results);

    } catch (error) {
      console.error(
        'My bookings error:',
        error
      );

      return res.status(500).json({
        message:
          'Failed to load your bookings'
      });
    }
  }
);

// ======================================================
// CANCEL MY BOOKING
// DELETE /api/bookings/:id
// ======================================================

router.delete(
  '/:id',
  protect,
  async (req, res) => {
    try {
      if (!validId(req.params.id)) {
        return res.status(400).json({
          message: 'Invalid booking ID'
        });
      }

      // ------------------------------------------------
      // AUTHENTICATE USER
      // ------------------------------------------------

      const user = await User.findById(
        req.userId
      );

      if (!user) {
        return res.status(401).json({
          message: 'User account not found'
        });
      }

      // ------------------------------------------------
      // FIND BOOKING
      // ------------------------------------------------

      const booking = await Booking.findById(
        req.params.id
      );

      if (!booking) {
        return res.status(404).json({
          message: 'Booking not found'
        });
      }

      // ------------------------------------------------
      // VERIFY OWNERSHIP
      // ------------------------------------------------

      const ownsBooking =
        (
          booking.user &&
          sameId(
            booking.user,
            user._id
          )
        ) ||
        (
          String(
            booking.studentEmail || ''
          )
            .trim()
            .toLowerCase() ===
          String(
            user.email || ''
          )
            .trim()
            .toLowerCase()
        );

      if (!ownsBooking) {
        return res.status(403).json({
          message:
            'You cannot cancel another user’s booking'
        });
      }

      // ------------------------------------------------
      // VALIDATE STATUS
      // ------------------------------------------------

      if (
        ![
          'Pending',
          'Approved'
        ].includes(booking.status)
      ) {
        return res.status(409).json({
          message:
            'Only pending or approved bookings can be cancelled'
        });
      }

      // ------------------------------------------------
      // CANCELLATION REASON
      // ------------------------------------------------

      const reason =
        typeof req.body?.cancellationReason === 'string' &&
        req.body.cancellationReason.trim()
          ? req.body.cancellationReason.trim()
          : 'Cancelled by requester';

      // ------------------------------------------------
      // CANCEL AND RELEASE EQUIPMENT
      // ------------------------------------------------

      const updated = await cancelBooking({
        bookingId: booking._id,

        allowedStatuses: [
          'Pending',
          'Approved'
        ],

        cancellationReason: reason,

        cancelledBy:
          user.role === 'staff'
            ? 'staff'
            : 'student'
      });

      await updated.populate(
        bookingPopulateOptions
      );

      return res.json({
        message:
          'Booking cancelled and assigned equipment released successfully',

        booking: updated
      });

    } catch (error) {
      console.error(
        'Cancel booking error:',
        error
      );

      return res.status(
        error.statusCode || 500
      ).json({
        message:
          error.message ||
          'Failed to cancel booking'
      });
    }
  }
);

// ======================================================
// DEBUG: SHOW REGISTERED BOOKING ROUTES
// ======================================================

console.log(
  'BOOKING ROUTES LOADED:',
  router.stack
    .filter(layer => layer.route)
    .map(layer => ({
      path: layer.route.path,
      methods: Object.keys(
        layer.route.methods
      )
    }))
);

module.exports = router;
