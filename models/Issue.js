const mongoose = require('mongoose');

const CAT = { Water: 2, Electrical: 3, Cleanliness: 1, Roads: 5, Safety: 1, Furniture: 4 }; // target fix days
const DAY = 864e5;

const history = new mongoose.Schema(
  { s: String, note: String, t: { type: Date, default: Date.now } }, { _id: false });

const schema = new mongoose.Schema({
  code:       { type: String, unique: true },
  title:      { type: String, required: true, maxlength: 80, trim: true },
  cat:        { type: String, enum: Object.keys(CAT), required: true },
  loc:        { type: String, required: true, trim: true },
  lat:        { type: Number, min: -90, max: 90 },
  lng:        { type: Number, min: -180, max: 180 },
  sev:        { type: Number, enum: [2, 3, 5], default: 3 },
  desc:       { type: String, maxlength: 300, default: '' },
  photo:      String,
  afterPhoto: String,
  reporter:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  meTooBy:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  status:     { type: String, enum: ['Reported', 'Acknowledged', 'In progress', 'Resolved', 'Closed'], default: 'Reported' },
  reopen:     { type: Number, default: 0 },
  closedAt:   Date,
  hist:       [history]
}, { timestamps: true });

// OOP: the Issue guards its own status, so no route can skip a step
class IssueRules {
  log(status, note) {
    this.status = status;
    this.hist.push({ s: status, note });
    if (status === 'Closed') this.closedAt = new Date();
  }

  transition(action, user, afterPhoto) {
    const staff = user.isStaff;
    const mine = String(this.reporter) === String(user._id);
    const bad = m => { const e = new Error(m); e.status = 400; throw e; };

    if (['ack', 'start', 'resolve'].includes(action) && !staff) bad('Only staff can do this');

    if (action === 'ack' && this.status === 'Reported')
      return this.log('Acknowledged', 'Deadline started: ' + CAT[this.cat] + ' days');
    if (action === 'start' && this.status === 'Acknowledged')
      return this.log('In progress', 'Staff working on it');
    if (action === 'resolve' && this.status === 'In progress') {
      if (!afterPhoto) bad('An after photo is required to mark this resolved');
      this.afterPhoto = afterPhoto;
      return this.log('Resolved', 'After photo uploaded');
    }
    if (['confirm', 'reopen'].includes(action) && this.status === 'Resolved') {
      if (!mine) bad('Only the reporter can confirm or reopen');
      if (action === 'confirm') return this.log('Closed', 'Reporter confirmed the fix');
      this.reopen++;
      return this.log('In progress', 'Reporter says it’s not fixed: reopened');
    }
    bad('That step is not allowed while the issue is "' + this.status + '"');
  }

  closeIfStale() { // no reply from reporter in 3 days
    const last = this.hist[this.hist.length - 1];
    if (this.status === 'Resolved' && Date.now() - last.t > 3 * DAY) {
      this.log('Closed', 'No reply in 3 days: closed as unconfirmed');
      return true;
    }
    return false;
  }

  toClient(uid) { // the shape the frontend expects
    const same = x => String(x) === String(uid);
    return {
      _id: this._id, id: this.code, title: this.title, cat: this.cat, loc: this.loc, lat: this.lat ?? null, lng: this.lng ?? null, sev: this.sev,
      desc: this.desc, people: 1 + this.meTooBy.length, mine: same(this.reporter),
      meToo: this.meTooBy.some(same), reopen: this.reopen, status: this.status,
      created: +this.createdAt, closedAt: this.closedAt ? +this.closedAt : null,
      hist: this.hist.map(h => ({ s: h.s, t: +h.t, note: h.note }))
    };
  }
}

schema.loadClass(IssueRules);
const Issue = mongoose.model('Issue', schema);
Issue.CAT = CAT;
module.exports = Issue;
