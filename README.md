# CivicLoop (full stack)

1. npm install
2. Copy .env.example to .env and fill in MONGO_URI, JWT_SECRET, STAFF_CODE
3. npm run seed      (optional: demo users and issues, password demo123)
4. npm start         then open http://localhost:3000

Demo logins after seeding: citizen@civicloop.com and staff@civicloop.com

Structure: server.js, models/ (User, Issue), routes/ (auth, issues), middleware/auth.js,
public/ (index.html, style.css, app.js), seed.js

## Map
The Explore page shows issues on an OpenStreetMap map (Leaflet, loaded from a CDN, so it needs internet).
- Tap the map to drop a pin, or press "Use my location", then press "Report issue".
- Issues saved with a pin appear as coloured markers. Change DEFAULT_CENTER at the top of public/js/app.js to your campus.
- After updating from an older version, run `npm run seed` again so the demo issues get coordinates (this resets the data).
