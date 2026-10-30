const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    // Telephone number for students and staff
    telephoneNumber: {
      type: String,
      trim: true,
      default: ''
    },

    registrationNo: {
      type: String,
      trim: true
    },

    batch: {
      type: String
    },

    password: {
      type: String,
      required: true,
      select: false
    },

    role: {
      type: String,
      enum: ['student', 'staff', 'admin'],
      default: 'student'
    },

    staffRequested: {
      type: Boolean,
      default: false
    },

    staffVerificationStatus: {
      type: String,
      enum: ['none', 'pending', 'approved', 'rejected'],
      default: 'none'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);