
const User = require('../models/User');

const adminOnly = async (req, res, next) => {
  try {
    if (!req.userId) {
      return res.status(401).json({
        message: 'Please login first'
      });
    }

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(401).json({
        message: 'User account not found. Please login again.'
      });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({
        message: 'Administrator access required'
      });
    }

    next();
  } catch (error) {
    console.error('Administrator verification error:', error);

    res.status(500).json({
      message: 'Administrator verification failed'
    });
  }
};

module.exports = adminOnly;
