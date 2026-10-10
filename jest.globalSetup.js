// Runs once before any test file. Every test runs in India's time zone (UTC+5:30), where the app's
// phones are, so a date test gives the same answer on a laptop in IST and a CI runner in UTC - and
// can show a UTC date being the wrong day just after midnight (audit L1, assessmentStatus.test.ts).
// Set here, not in a test file: Jest hands each test a copy of process.env, so TZ set there is ignored.
module.exports = () => {
  process.env.TZ = 'Asia/Kolkata';
};
