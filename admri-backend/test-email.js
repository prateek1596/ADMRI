// test-email.js
// Run with: node test-email.js
// Tests the SMTP alert system end-to-end

require('dotenv').config();
const { sendRiskSpikeAlert, sendWelcomeEmail } = require('./src/services/emailService');

async function runTests() {
  console.log('\n═══════════════════════════════════════════');
  console.log('  ADMRI Email Alert System — Test Runner');
  console.log('═══════════════════════════════════════════\n');

  console.log('SMTP Config:');
  console.log('  Host:', process.env.SMTP_HOST || 'smtp.gmail.com');
  console.log('  User:', process.env.SMTP_USER || '❌ NOT SET');
  console.log('  Pass:', process.env.SMTP_PASS ? '✅ SET' : '❌ NOT SET');
  console.log('  From:', process.env.ALERT_FROM || '❌ NOT SET');
  console.log('');

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('❌ SMTP not configured in .env');
    console.log('   Add SMTP_USER, SMTP_PASS, ALERT_FROM to your .env file');
    process.exit(1);
  }

  // ── Test 1: Risk Spike Alert ─────────────────────────────────────────────
  console.log('Test 1: Sending risk spike alert...');
  try {
    await sendRiskSpikeAlert({
      doctor: {
        id:    'test-doctor-001',
        name:  'Dr. Priya Sharma',
        email: process.env.SMTP_USER, // sends to your own email for testing
      },
      patient: {
        id:        'test-patient-001',
        name:      'Aarav Sharma (Test)',
        age:       12,
        gender:    'Male',
        diagnosis: 'Generalised Anxiety Disorder',
      },
      previousScore: 45,
      newScore:      72,
      delta:         27,
      assessmentId:  'test-assess-' + Date.now(),
    });
    console.log('✅ Risk spike alert sent to', process.env.SMTP_USER);
  } catch (err) {
    console.log('❌ Risk spike alert failed:', err.message);
  }

  console.log('');

  // ── Test 2: Welcome Email ────────────────────────────────────────────────
  console.log('Test 2: Sending welcome email...');
  try {
    await sendWelcomeEmail({
      name:  'Dr. Test Doctor',
      email: process.env.SMTP_USER,
    });
    console.log('✅ Welcome email sent to', process.env.SMTP_USER);
  } catch (err) {
    console.log('❌ Welcome email failed:', err.message);
  }

  console.log('\n═══════════════════════════════════════════');
  console.log('  Check your inbox:', process.env.SMTP_USER);
  console.log('  (also check spam folder)');
  console.log('═══════════════════════════════════════════\n');
}

runTests().catch(err => {
  console.error('Test runner failed:', err.message);
  process.exit(1);
});
