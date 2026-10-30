const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('../models/User');

const router = express.Router();

// ======================================================
// TELEPHONE NUMBER VALIDATION
// ======================================================

// Accept Sri Lankan telephone numbers in these formats:
// 0771234567

// Spaces and hyphens are removed before validation.

const normalizeTelephoneNumber = (telephoneNumber) => {
  if (typeof telephoneNumber !== 'string') {
    return '';
  }

  return telephoneNumber
    .trim()
    .replace(/[\s-]/g, '');
};

const isValidTelephoneNumber = (telephoneNumber) => {
  return /^0\d{9}$/.test(telephoneNumber);
};

// ======================================================
// REGISTER
// ======================================================

router.post('/register', async (req, res) => {
  try {
    const {
      name,
      registrationNo,
      batch,
      email,
      telephoneNumber,
      password,
      role
    } = req.body;

    const isStaffRequest = role === 'staff';

    // ==================================================
    // CHECK REQUIRED FIELDS
    // ==================================================

    if (
      typeof name !== 'string' ||
      typeof email !== 'string' ||
      typeof telephoneNumber !== 'string' ||
      typeof password !== 'string' ||
      !name.trim() ||
      !email.trim() ||
      !telephoneNumber.trim() ||
      !password ||
      (!isStaffRequest && (
        typeof registrationNo !== 'string' ||
        typeof batch !== 'string' ||
        !registrationNo.trim() ||
        !batch.trim()
      ))
    ) {
      return res.status(400).json({
        message: 'Please fill in all required fields'
      });
    }

    // ==================================================
    // VALIDATE TELEPHONE NUMBER
    // ==================================================

    const normalizedTelephoneNumber =
      normalizeTelephoneNumber(telephoneNumber);

    if (!isValidTelephoneNumber(normalizedTelephoneNumber)) {
      return res.status(400).json({
        message:
          'Please enter a valid telephone number with 10 digits'
      });
    }

    // ==================================================
    // CHECK PASSWORD LENGTH
    // ==================================================

    if (password.length < 8) {
      return res.status(400).json({
        message: 'Password must contain at least 8 characters'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // ==================================================
    // CHECK WHETHER EMAIL ALREADY EXISTS
    // ==================================================

    const existingUser = await User.findOne({
      email: normalizedEmail
    });

    if (existingUser) {
      return res.status(409).json({
        message: 'An account with this email already exists'
      });
    }

    // ==================================================
    // HASH PASSWORD
    // ==================================================

    const hashedPassword = await bcrypt.hash(password, 12);

    // ==================================================
    // CREATE USER ACCOUNT
    // ==================================================

    // Staff registrations remain student-role accounts
    // until approved by the administrator.

    const user = await User.create({
      name: name.trim(),

      registrationNo: isStaffRequest
        ? ''
        : registrationNo.trim(),

      batch: isStaffRequest
        ? ''
        : batch.trim(),

      email: normalizedEmail,

      // New telephone number field
      telephoneNumber: normalizedTelephoneNumber,

      password: hashedPassword,

      role: 'student',

      staffRequested: isStaffRequest,

      staffVerificationStatus: isStaffRequest
        ? 'pending'
        : 'none'
    });

    // ==================================================
    // REGISTRATION RESPONSE
    // ==================================================

    res.status(201).json({
      message: 'Registration successful',

      user: {
        id: user._id,
        name: user.name,
        registrationNo: user.registrationNo,
        batch: user.batch,
        email: user.email,
        telephoneNumber: user.telephoneNumber,
        role: user.role,
        staffRequested: user.staffRequested,
        staffVerificationStatus: user.staffVerificationStatus
      }
    });

  } catch (error) {
    console.error('Registration error:', error);

    if (error.code === 11000) {
      return res.status(409).json({
        message: 'An account with this email already exists'
      });
    }

    res.status(500).json({
      message: 'Registration failed'
    });
  }
});

// ======================================================
// LOGIN
// ======================================================

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // ==================================================
    // CHECK REQUIRED FIELDS
    // ==================================================

    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: 'Email and password are required'
      });
    }

    // ==================================================
    // FIND USER BY EMAIL
    // ==================================================

    const user = await User.findOne({
      email: email.trim().toLowerCase()
    }).select('+password');

    if (!user) {
      return res.status(401).json({
        message: 'Invalid email or password'
      });
    }

    // ==================================================
    // VERIFY PASSWORD
    // ==================================================

    const isPasswordValid = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        message: 'Invalid email or password'
      });
    }

    // ==================================================
    // CHECK JWT SECRET
    // ==================================================

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not configured');
    }

    // ==================================================
    // GENERATE LOGIN TOKEN
    // ==================================================

    const token = jwt.sign(
      {
        userId: user._id.toString()
      },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    // ==================================================
    // LOGIN RESPONSE
    // ==================================================

    res.status(200).json({
      message: 'Login successful',
      token,

      user: {
        id: user._id,
        name: user.name,

        // Include student details where applicable
        registrationNo: user.registrationNo,
        batch: user.batch,

        email: user.email,

        // Include telephone number for profile display
        telephoneNumber: user.telephoneNumber || '',

        role: user.role,
        staffRequested: user.staffRequested,
        staffVerificationStatus: user.staffVerificationStatus
      }
    });

  } catch (error) {
    console.error('Login error:', error);

    res.status(500).json({
      message: 'Login failed'
    });
  }
});

module.exports = router;