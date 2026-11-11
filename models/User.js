const mongoose = require('mongoose');

// OOP: behaviour lives in a class, attached to the schema
class UserRules {
  get isStaff() { return this.role === 'staff' || this.role === 'admin'; }
  toPublic() { return { id: this._id, name: this.name, role: this.role }; }
}

const schema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role:     { type: String, enum: ['citizen', 'staff', 'admin'], default: 'citizen' }
}, { timestamps: true });

schema.loadClass(UserRules);
module.exports = mongoose.model('User', schema);
