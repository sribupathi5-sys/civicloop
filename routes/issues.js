const router = require('express').Router();
const Issue = require('../models/Issue');
const { optional, required } = require('../middleware/auth');

const ll = (x, max) => (x !== null && x !== '' && Number.isFinite(+x) && Math.abs(+x) <= max) ? +x : undefined;
const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);

// READ: public list (logged-in users also get "mine" / "meToo" flags)
router.get('/', optional, wrap(async (req, res) => {
  const issues = await Issue.find().sort({ createdAt: -1 });
  for (const i of issues) if (i.closeIfStale()) await i.save();
  res.json(issues.map(i => i.toClient(req.user && req.user._id)));
}));

// CREATE
router.post('/', required, wrap(async (req, res) => {
  const { title, cat, loc, sev, desc, photo, lat, lng } = req.body;
  if (!title || !loc || !Issue.CAT[cat]) return res.status(400).json({ error: 'Title, category and location are required' });
  const last = await Issue.findOne().sort({ createdAt: -1 });
  const n = last ? parseInt(last.code.slice(3), 10) + 1 : 142;
  const issue = await Issue.create({
    code: 'CL-' + n, title, cat, loc, desc, photo, lat: ll(lat, 90), lng: ll(lng, 180), sev: [2, 3, 5].includes(+sev) ? +sev : 3,
    reporter: req.user._id, hist: [{ s: 'Reported', note: 'Photo and location added' }]
  });
  res.status(201).json(issue.toClient(req.user._id));
}));

// UPDATE: "Me too" (toggle)
router.post('/:id/metoo', required, wrap(async (req, res) => {
  const issue = await Issue.findById(req.params.id);
  if (!issue) return res.status(404).json({ error: 'Issue not found' });
  if (String(issue.reporter) === String(req.user._id)) return res.status(400).json({ error: 'You reported this issue yourself' });
  const has = issue.meTooBy.some(x => String(x) === String(req.user._id));
  issue.meTooBy = has ? issue.meTooBy.filter(x => String(x) !== String(req.user._id)) : [...issue.meTooBy, req.user._id];
  await issue.save();
  res.json(issue.toClient(req.user._id));
}));

// UPDATE: move through the verify-the-fix loop
router.patch('/:id/status', required, wrap(async (req, res) => {
  const issue = await Issue.findById(req.params.id);
  if (!issue) return res.status(404).json({ error: 'Issue not found' });
  issue.transition(req.body.action, req.user, req.body.afterPhoto);   // throws if not allowed
  await issue.save();
  res.json(issue.toClient(req.user._id));
}));

// DELETE: admin only (spam removal)
router.delete('/:id', required, wrap(async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  await Issue.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
}));

module.exports = router;
