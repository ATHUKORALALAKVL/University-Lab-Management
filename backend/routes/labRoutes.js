
const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

const Lab = require('../models/Lab');
const Booking = require('../models/Booking');

const protect = require('../middleware/authMiddleware');
const adminOnly = require('../middleware/adminMiddleware');



router.get('/', async (req, res) => {
  try {
    const labs = await Lab.find().sort({ name: 1 });

    res.json(labs);
  } catch (error) {
    console.error(
      'Error fetching laboratories:',
      error.message
    );

    res.status(500).json({
      message: 'Failed to fetch laboratories'
    });
  }
});



router.get('/:id/schedule', async (req, res) => {
  try {
    const { id } = req.params;
    const { month } = req.query;

    // Validate laboratory ID.

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: 'Invalid laboratory ID'
      });
    }

    // Validate month format.

    if (
      typeof month !== 'string' ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)
    ) {
      return res.status(400).json({
        message:
          'Month must be in YYYY-MM format'
      });
    }

    // Check that the laboratory exists.

    const lab = await Lab.findById(id);

    if (!lab) {
      return res.status(404).json({
        message: 'Laboratory not found'
      });
    }

    // Calculate first day of requested month
    // and first day of following month.

    const [year, monthNumber] =
      month.split('-').map(Number);

    const startOfMonth = new Date(
      Date.UTC(year, monthNumber - 1, 1)
    );

    const startOfNextMonth = new Date(
      Date.UTC(year, monthNumber, 1)
    );

    // Retrieve only approved lab bookings.

    const bookings = await Booking.find({
      lab: lab._id,

      bookingType: {
        $ne: 'equipment'
      },

      status: 'Approved',

      bookingDate: {
        $gte: startOfMonth,
        $lt: startOfNextMonth
      }
    })
     .select(
  '_id bookingDate startTime endTime purpose'
)
      .sort({
        bookingDate: 1,
        startTime: 1
      })
      .lean();

    

   const schedule = bookings.map((booking) => ({
  _id: booking._id,

  bookingDate:
    booking.bookingDate
      .toISOString()
      .slice(0, 10),

  startTime: booking.startTime,
  endTime: booking.endTime,

  purpose: booking.purpose || ''
}));

    return res.json(schedule);
  } catch (error) {
    console.error(
      'Error fetching laboratory schedule:',
      error
    );

    return res.status(500).json({
      message:
        'Failed to load laboratory schedule'
    });
  }
});



router.post(
  '/',
  protect,
  adminOnly,
  async (req, res) => {
    try {
      const {
        name,
        description,
        location,
        capacity,
        isAvailable
      } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({
          message: 'Laboratory name is required'
        });
      }

      const capacityNumber = Number(
        capacity ?? 0
      );

      if (
        !Number.isInteger(capacityNumber) ||
        capacityNumber < 0
      ) {
        return res.status(400).json({
          message:
            'Capacity must be a non-negative whole number'
        });
      }

      const lab = await Lab.create({
        name: name.trim(),
        description: description || '',
        location: location || '',
        capacity: capacityNumber,

        isAvailable:
          typeof isAvailable === 'boolean'
            ? isAvailable
            : true
      });

      res.status(201).json(lab);
    } catch (error) {
      console.error(
        'Error adding laboratory:',
        error
      );

      res.status(500).json({
        message: 'Failed to add laboratory'
      });
    }
  }
);

// EDIT LABORATORY DETAILS


router.put(
  '/:id',
  protect,
  adminOnly,
  async (req, res) => {
    try {
      const {
        name,
        description,
        location,
        capacity,
        isAvailable
      } = req.body;

      if (
        typeof name !== 'string' ||
        !name.trim()
      ) {
        return res.status(400).json({
          message: 'Laboratory name is required'
        });
      }

      const capacityNumber = Number(capacity);

      if (
        !Number.isInteger(capacityNumber) ||
        capacityNumber < 0
      ) {
        return res.status(400).json({
          message:
            'Capacity must be a non-negative whole number'
        });
      }

      const lab = await Lab.findByIdAndUpdate(
        req.params.id,
        {
          name: name.trim(),
          description: description || '',
          location: location || '',
          capacity: capacityNumber,

          ...(typeof isAvailable === 'boolean'
            ? { isAvailable }
            : {})
        },
        {
          new: true,
          runValidators: true
        }
      );

      if (!lab) {
        return res.status(404).json({
          message: 'Laboratory not found'
        });
      }

      res.json(lab);
    } catch (error) {
      console.error(
        'Error updating laboratory:',
        error
      );

      res.status(500).json({
        message:
          'Failed to update laboratory'
      });
    }
  }
);

// ======================================================
// ENABLE OR DISABLE LABORATORY
// Admin only
// PATCH /api/labs/:id/availability
// ======================================================

router.patch(
  '/:id/availability',
  protect,
  adminOnly,
  async (req, res) => {
    try {
      if (
        typeof req.body.isAvailable !== 'boolean'
      ) {
        return res.status(400).json({
          message:
            'isAvailable must be true or false'
        });
      }

      const lab = await Lab.findByIdAndUpdate(
        req.params.id,
        {
          isAvailable: req.body.isAvailable
        },
        {
          new: true,
          runValidators: true
        }
      );

      if (!lab) {
        return res.status(404).json({
          message: 'Laboratory not found'
        });
      }

      res.json(lab);
    } catch (error) {
      console.error(
        'Error changing laboratory availability:',
        error
      );

      res.status(500).json({
        message:
          'Failed to change laboratory availability'
      });
    }
  }
);

module.exports = router;
