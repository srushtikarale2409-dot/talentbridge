/* =========================================================
   TalentBridge — click-to-call backend
   ---------------------------------------------------------
   What this does, in plain terms:
   1. A website visitor clicks "Call Now" and enters their number.
   2. The browser sends that number to this server.
   3. This server asks Twilio to call YOUR phone (the business owner).
   4. The moment you pick up, Twilio automatically dials the
      visitor's number and joins both calls together.
   Your phone rings first — that's the "call me" experience.

   Setup:
   1. npm install
   2. Create a free Twilio account: https://www.twilio.com/try-twilio
      - Copy your Account SID and Auth Token from the console dashboard
      - Buy/claim a Twilio phone number (trial accounts get one free)
   3. Copy .env.example to .env and fill in the four values
   4. npm start
   5. For local testing, expose this server to the internet with ngrok:
      ngrok http 3000
      (Twilio needs a public URL to call back into this server)
   ========================================================= */

require('dotenv').config();
const express = require('express');
const twilio = require('twilio');

const app = express();
app.use(express.json());
app.use(express.static(__dirname)); // serves index.html, style.css, Script.js, etc.

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER, // the number Twilio gave you, e.g. +14155551234
  OWNER_PHONE_NUMBER,  // YOUR real phone number that should ring first
  PUBLIC_BASE_URL      // e.g. https://abcd1234.ngrok-free.app (no trailing slash)
} = process.env;

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

/* Step 1: visitor submits their number -> call the owner first */
app.post('/api/click-to-call', async (req, res) => {
  const visitorNumber = (req.body.phone || '').trim();
  if (!visitorNumber) {
    return res.status(400).json({ error: 'Phone number is required.' });
  }
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER || !OWNER_PHONE_NUMBER || !PUBLIC_BASE_URL) {
    return res.status(500).json({ error: 'Server is missing Twilio configuration. Check your .env file.' });
  }
  try {
    const call = await client.calls.create({
      to: OWNER_PHONE_NUMBER,
      from: TWILIO_PHONE_NUMBER,
      // When the owner answers, Twilio fetches this URL to know what to do next
      url: `${PUBLIC_BASE_URL}/api/bridge?visitor=${encodeURIComponent(visitorNumber)}`
    });
    res.json({ success: true, callSid: call.sid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not place the call. Check your Twilio credentials and number format.' });
  }
});

/* Step 2: owner answered -> tell Twilio to now dial the visitor and join the call */
app.post('/api/bridge', (req, res) => {
  const visitorNumber = req.query.visitor;
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say('Connecting you to a website visitor now.');
  const dial = twiml.dial({ callerId: TWILIO_PHONE_NUMBER });
  dial.number(visitorNumber);
  res.type('text/xml');
  res.send(twiml.toString());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`TalentBridge server running on http://localhost:${PORT}`));