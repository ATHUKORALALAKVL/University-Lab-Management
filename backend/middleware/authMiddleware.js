
const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      message: 'Please login first'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.userId = decoded.userId;
    next();
  
} catch (error) {
  console.error('JWT verification error:', error.name, error.message);

  res.status(401).json({
    message: 'Invalid or expired login token'
  });
}

};

module.exports = protect;
