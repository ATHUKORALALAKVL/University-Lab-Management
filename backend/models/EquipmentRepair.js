
const mongoose = require('mongoose');

const equipmentRepairSchema = new mongoose.Schema({
  equipment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Equipment',
    required: true,
    index: true
  },
  equipmentItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EquipmentItem',
    required: true,
    index: true
  },
  startDate: {
    type: String,
    required: true
  },
  endDate: {
    type: String,
    required: true
  },
  notes: {
    type: String,
    default: ''
  },
  completedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

equipmentRepairSchema.index({
  equipmentItem: 1,
  startDate: 1,
  endDate: 1
});

module.exports = mongoose.model(
  'EquipmentRepair',
  equipmentRepairSchema
);
