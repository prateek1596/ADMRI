const nodemailer = require('nodemailer');
const logger = require('../config/logger');

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST || 'smtp.gmail.com',
      port:   parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

// ── Risk spike alert ─────────────────────────────────────────────────────────
async function sendRiskSpikeAlert({ doctor, patient, previousScore, newScore, delta, assessmentId }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    logger.warn('Email not configured — skipping risk spike alert', { patientId: patient.id });
    return;
  }

  const riskLevel = newScore >= 76 ? 'SEVERE' : newScore >= 61 ? 'HIGH' : 'MODERATE';
  const riskColor = newScore >= 76 ? '#B71C1C' : newScore >= 61 ? '#E65100' : '#F9A825';

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
    <body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:0">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1)">
        
        <div style="background:#0D1B2A;padding:24px 32px">
          <div style="color:#58A6FF;font-size:22px;font-weight:bold">ADMRI</div>
          <div style="color:#8B949E;font-size:13px;margin-top:4px">Adaptive Digital Mental Health Risk Index</div>
        </div>

        <div style="background:${riskColor};padding:16px 32px">
          <div style="color:#ffffff;font-size:18px;font-weight:bold">
            ⚠️ Risk Spike Alert — ${riskLevel}
          </div>
        </div>

        <div style="padding:32px">
          <p style="color:#37474F;font-size:15px;margin-top:0">
            Dear Dr. ${doctor.name},
          </p>
          <p style="color:#37474F;font-size:15px">
            A significant increase in ADMRI risk score has been detected for one of your patients.
            Immediate clinical review is recommended.
          </p>

          <div style="background:#F5F7FA;border-radius:8px;padding:20px;margin:24px 0">
            <table style="width:100%;border-collapse:collapse">
              <tr>
                <td style="color:#8B949E;font-size:13px;padding:6px 0;width:40%">Patient</td>
                <td style="color:#0D1B2A;font-size:14px;font-weight:bold;padding:6px 0">${patient.name}</td>
              </tr>
              <tr>
                <td style="color:#8B949E;font-size:13px;padding:6px 0">Age / Gender</td>
                <td style="color:#0D1B2A;font-size:14px;padding:6px 0">${patient.age} / ${patient.gender}</td>
              </tr>
              <tr>
                <td style="color:#8B949E;font-size:13px;padding:6px 0">Diagnosis</td>
                <td style="color:#0D1B2A;font-size:14px;padding:6px 0">${patient.diagnosis || 'Not specified'}</td>
              </tr>
              <tr><td colspan="2" style="border-top:1px solid #E0E0E0;padding:4px 0"></td></tr>
              <tr>
                <td style="color:#8B949E;font-size:13px;padding:6px 0">Previous Score</td>
                <td style="color:#0D1B2A;font-size:14px;padding:6px 0">${previousScore}/100</td>
              </tr>
              <tr>
                <td style="color:#8B949E;font-size:13px;padding:6px 0">New Score</td>
                <td style="color:${riskColor};font-size:18px;font-weight:bold;padding:6px 0">${newScore}/100 — ${riskLevel}</td>
              </tr>
              <tr>
                <td style="color:#8B949E;font-size:13px;padding:6px 0">Change</td>
                <td style="color:${riskColor};font-size:14px;font-weight:bold;padding:6px 0">+${delta} points</td>
              </tr>
              <tr>
                <td style="color:#8B949E;font-size:13px;padding:6px 0">Assessment ID</td>
                <td style="color:#0D1B2A;font-size:13px;font-family:monospace;padding:6px 0">${assessmentId}</td>
              </tr>
              <tr>
                <td style="color:#8B949E;font-size:13px;padding:6px 0">Date/Time</td>
                <td style="color:#0D1B2A;font-size:14px;padding:6px 0">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</td>
              </tr>
            </table>
          </div>

          ${newScore >= 61 ? `
          <div style="background:#FFF8E1;border-left:4px solid #F9A825;border-radius:4px;padding:16px;margin-bottom:24px">
            <div style="color:#E65100;font-weight:bold;font-size:14px;margin-bottom:8px">Crisis Resources (India)</div>
            <div style="color:#37474F;font-size:13px;line-height:1.8">
              iCall (TISS): <strong>9152987821</strong><br>
              Vandrevala Foundation (24/7): <strong>1860-2662-345</strong><br>
              NIMHANS: <strong>080-46110007</strong>
            </div>
          </div>` : ''}

          <p style="color:#8B949E;font-size:12px;border-top:1px solid #E0E0E0;padding-top:16px;margin-bottom:0">
            This is an automated alert from the ADMRI Clinical Platform. 
            This alert does not constitute a clinical diagnosis. 
            Always apply professional judgment. 
            To adjust alert thresholds, visit your account settings.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await getTransporter().sendMail({
      from:    process.env.ALERT_FROM || `ADMRI System <${process.env.SMTP_USER}>`,
      to:      doctor.email,
      subject: `[ADMRI ALERT] Risk spike detected — ${patient.name} (${newScore}/100, +${delta} pts)`,
      html,
    });
    logger.info('Risk spike alert sent', { doctorId: doctor.id, patientId: patient.id, newScore, delta });
  } catch (err) {
    logger.error('Failed to send risk spike alert email', { error: err.message });
  }
}

// ── General notification ─────────────────────────────────────────────────────
async function sendWelcomeEmail({ name, email }) {
  if (!process.env.SMTP_USER) return;
  try {
    await getTransporter().sendMail({
      from:    process.env.ALERT_FROM,
      to:      email,
      subject: 'Welcome to ADMRI Clinical Platform',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto">
          <h2 style="color:#0D1B2A">Welcome to ADMRI, Dr. ${name}</h2>
          <p style="color:#37474F">Your account has been created on the Adaptive Digital Mental Health Risk Index platform.</p>
          <p style="color:#37474F">You can now log in and begin adding patients and running assessments.</p>
          <p style="color:#8B949E;font-size:12px">If you did not create this account, please contact your administrator.</p>
        </div>
      `,
    });
  } catch (err) {
    logger.error('Failed to send welcome email', { error: err.message });
  }
}

module.exports = { sendRiskSpikeAlert, sendWelcomeEmail };
