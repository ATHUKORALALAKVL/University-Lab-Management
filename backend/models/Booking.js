
const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    // Distinguish laboratory bookings from
    // staff-only equipment bookings.
    bookingType: {
      type: String,
      enum: ['lab', 'equipment'],
      default: 'lab',
      required: true
    },

    // Required for laboratory bookings only.
    // Equipment-only bookings do not reserve lab space.
    lab: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lab',
      default: null,
      required: function () {
        return this.bookingType === 'lab';
      }
    },

    studentName: {
      type: String,
      required: true
    },

    studentEmail: {
      type: String,
      required: true
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },

    requesterRole: {
      type: String,
      enum: ['student', 'staff', 'admin'],
      default: undefined
    },

    bookingDate: {
      type: Date,
      required: true
    },

    startTime: {
      type: String,
      required: true
    },

    endTime: {
      type: String,
      required: true
    },

    purpose: {
      type: String,
      required: true
    },

    // Requested equipment quantities.
    equipment: [
      {
        equipmentId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Equipment',
          required: true
        },

        quantity: {
          type: Number,
          required: true,
          min: 1
        }
      }
    ],

    // Quantities approved by the administrator.
    approvedEquipment: [
      {
        equipmentId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Equipment',
          required: true
        },

        quantity: {
          type: Number,
          required: true,
          min: 0
        }
      }
    ],

    // Individual physical equipment units assigned.
    issuedEquipmentItems: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EquipmentItem'
      }
    ],

    // Equipment retirement warning for administrators.
    equipmentNeedsAttention: {
      type: Boolean,
      default: false
    },

    // Retired physical equipment units that still
    // require replacement in this booking.
    affectedEquipmentItems: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EquipmentItem'
      }
    ],

    adminComment: {
      type: String,
      default: ''
    },

    rejectionReason: {
      type: String,
      default: ''
    },

    cancellationReason: {
      type: String,
      default: ''
    },

    cancellationRequestedBy: {
      type: String,
      enum: ['student', 'staff', 'admin', ''],
      default: ''
    },

    status: {
      type: String,
      enum: [
        'Pending',
        'Approved',
        'Rejected',
        'Cancellation Requested',
        'Cancelled'
      ],
      default: 'Pending'
    },

    statusChangedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Booking', bookingSchema);
