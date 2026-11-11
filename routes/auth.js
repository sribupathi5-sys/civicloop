const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);
const token = u => jwt.sign({ id: u._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

router.post('/register', wrap(async (req, res) => {
  const { name, email, password, staffCode } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (await User.findOne({ email: email.toLowerCase() })) return res.status(400).json({ error: 'That email is already registered' });
  const role = staffCode && staffCode === process.env.STAFF_CODE ? 'staff' : 'citizen';
  if (staffCode && role === 'citizen') return res.status(400).json({ error: 'Staff code is incorrect' });
  const user = await User.create({ name, email, role, password: await bcrypt.hash(password, 10) });
  res.json({ token: token(user), user: user.toPublic() });
}));

router.post('/login', wrap(async (req, res) => {
  const user = await User.findOne({ email: (req.body.email || '').toLowerCase() });
  if (!user || !(await bcrypt.compare(req.body.password || '', user.password)))
    return res.status(400).json({ error: 'Email or password is wrong' });
  res.json({ token: token(user), user: user.toPublic() });
}));

module.exports = router;
