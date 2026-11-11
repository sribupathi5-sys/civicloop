// Fills the database with demo users and issues:  npm run seed
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Issue = require('./models/Issue');

const ago = d => new Date(Date.now() - d * 864e5);
const h = list => list.map(([s, d, note]) => ({ s, t: ago(d), note }));

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await Issue.deleteMany({}); await User.deleteMany({});
  const pw = await bcrypt.hash('demo123', 10);
  const [citizen, other, staff] = await User.create([
    { name: 'Demo Citizen', email: 'citizen@civicloop.com', password: pw },
    { name: 'Another Student', email: 'student@civicloop.com', password: pw },
    { name: 'Facilities Staff', email: 'staff@civicloop.com', password: pw, role: 'staff' }
  ]);
  const P = ['Block B · 2nd floor corridor', 'Main gate · road side', 'Library · reading hall', 'Hostel A · mess', 'Canteen · back lane'];
  const COORD = { 'CL-142': [16.4312, 80.5598], 'CL-143': [16.4268, 80.5641], 'CL-144': [16.4295, 80.5662], 'CL-145': [16.4331, 80.5631], 'CL-146': [16.4322, 80.5612], 'CL-141': [16.4284, 80.5579] };
  const mk = (code, title, cat, loc, sev, days, status, hist, by, extra = {}) =>
    ({ code, title, cat, loc, sev, reporter: by, status, createdAt: ago(days), hist: h(hist), lat: (COORD[code] || [])[0], lng: (COORD[code] || [])[1], ...extra });

  await Issue.create([
    mk('CL-142', 'Water cooler leaking', 'Water', P[0], 5, 4, 'In progress',
      [['Reported', 4, 'Photo and location added'], ['Acknowledged', 4, 'Deadline started: 2 days'], ['In progress', 3, 'Staff working on it']], other, { meTooBy: [citizen._id] }),
    mk('CL-143', 'Streetlight not working near gate', 'Electrical', P[1], 5, 1, 'Reported',
      [['Reported', 1, 'Photo and location added']], other),
    mk('CL-144', 'Overflowing bins behind canteen', 'Cleanliness', P[4], 3, 3, 'Resolved',
      [['Reported', 3, 'Photo and location added'], ['Acknowledged', 3], ['In progress', 2], ['Resolved', 0.5, 'After photo uploaded']], citizen, { afterPhoto: 'demo' }),
    mk('CL-145', 'Pothole outside the library', 'Roads', P[2], 3, 6, 'Acknowledged',
      [['Reported', 6, 'Photo and location added'], ['Acknowledged', 5, 'Deadline started: 5 days']], other, { meTooBy: [citizen._id, staff._id] }),
    mk('CL-146', 'Ceiling fan stopped in reading hall', 'Electrical', P[2], 3, 2, 'In progress',
      [['Reported', 2, 'Photo and location added'], ['Acknowledged', 2], ['In progress', 1, 'Staff working on it']], citizen),
    mk('CL-141', 'Broken bench in the garden', 'Furniture', P[3], 2, 9, 'Closed',
      [['Reported', 9], ['Acknowledged', 9], ['In progress', 8], ['Resolved', 5, 'After photo uploaded'], ['Closed', 4, 'Reporter confirmed the fix']], other, { closedAt: ago(4), afterPhoto: 'demo' })
  ]);
  console.log('Seeded! Log in with (password demo123):\n  citizen@civicloop.com\n  staff@civicloop.com');
  process.exit(0);
})().catch(e => { console.log(e.message); process.exit(1); });
