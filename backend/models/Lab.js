
const mongoose = require('mongoose');

// Define the laboratory schema
const labSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },

  description: {
    type: String,
    default: ''
  },

  location: {
    type: String,
    default: ''
  },

  capacity: {
    type: Number,
    default: 0
  },

  isAvailable: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Create and export the Lab model
module.exports = mongoose.model('Lab', labSchema);
