
const mongoose = require('mongoose');

const equipmentItemSchema = new mongoose.Schema(
  {
    equipment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Equipment',
      required: true
    },

    equipmentId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },

    // Status of each individual physical equipment unit
    status: {
      type: String,
      enum: [
        'Available',
        'Issued',
        'Unavailable',
        'Under Repair'
      ],
      default: 'Available'
    },

    // User to whom the equipment was issued
    issuedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    // Permanent retirement information
    isRetired: {
      type: Boolean,
      default: false
    },

    retiredAt: {
      type: Date,
      default: null
    },

    retirementReason: {
      type: String,
      trim: true,
      default: ''
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  'EquipmentItem',
  equipmentItemSchema
);
