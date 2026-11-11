const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function load(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  try {
    const { id } = jwt.verify(h.slice(7), process.env.JWT_SECRET);
    return await User.findById(id);
  } catch { return null; }
}

exports.optional = async (req, res, next) => { req.user = await load(req); next(); };
exports.required = async (req, res, next) => {
  req.user = await load(req);
  req.user ? next() : res.status(401).json({ error: 'Please log in first' });
};
