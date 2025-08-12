const nodemailer = require("nodemailer");
const { db } = require("./db.js");
const config = require("../config.json");

async function getSMTPSettings() {
  const smtpSettings = await db.get("smtp_settings");
  const name = (await db.get("name")) || "Impulse";

  if (!smtpSettings) {
    throw new Error("SMTP settings not found");
  }

  return {
    transporter: nodemailer.createTransport({
      host: smtpSettings.server,
      port: smtpSettings.port,
      secure: smtpSettings.port !== 587 && smtpSettings.port !== 25,
      auth: {
        user: smtpSettings.username,
        pass: smtpSettings.password,
      },
      tls: { rejectUnauthorized: false },
    }),
    name,
    smtpSettings,
  };
}

function getWelcomeEmailHTML(username, companyName, loginUrl) {
  return `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2c3e50;">Welcome to ${companyName}!</h2>
          <p>Dear <strong>${username}</strong>,</p>
          <p>Thank you for creating an account with us. Your account has been successfully created!</p>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Your account details:</strong></p>
            <ul style="margin: 10px 0;">
              <li><strong>Username:</strong> ${username}</li>
              <li><strong>Login URL:</strong> <a href="${loginUrl}" style="color: #007bff;">${loginUrl}</a></li>
            </ul>
          </div>
          
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107; margin: 20px 0;">
            <p><strong>Security Notice:</strong></p>
            <p>For your security, we do not include passwords in emails. Please use the password you created during registration to log in.</p>
            <p>If you forgot your password, you can reset it using the "Forgot Password" link on the login page.</p>
          </div>
          
          <p>We hope you enjoy using ${companyName}!</p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="font-size: 12px; color: #666;">
            This is an automated message. Please do not reply to this email.<br>
            If you did not create this account, please contact our support team immediately.
          </p>
        </div>
      </body>
    </html>
  `;
}

async function sendEmail(mailOptions) {
  const { transporter } = await getSMTPSettings();
  return transporter.sendMail(mailOptions);
}

async function sendWelcomeEmail(email, username, loginUrl = null) {
  const { smtpSettings, name } = await getSMTPSettings();
  const baseUrl = loginUrl || require("../config.json").baseUri || "http://localhost:3000";
  const fullLoginUrl = `${baseUrl}/auth`;
  
  const mailOptions = {
    from: `${smtpSettings.fromName || name} <${smtpSettings.fromAddress || `${name}@impulse.dev`}>`,
    to: email,
    subject: `Welcome to ${name} - Account Created Successfully`,
    html: getWelcomeEmailHTML(username, name, fullLoginUrl),
  };
  await sendEmail(mailOptions);
  console.log(`Secure welcome email sent to ${email}`);
}

async function sendVerificationEmail(email, token) {
  const { smtpSettings, name } = await getSMTPSettings();
  const mailOptions = {
    from: `${smtpSettings.fromName} <${smtpSettings.fromAddress}>`,
    to: email,
    subject: "Verify Your Email Address",
    html: `
      <div>
        <h2>Verify Your Email Address</h2>
        <p>Thank you for registering on ${name}. Please click the button below to verify your email address:</p>
        <a href="${config.baseUri}/verify/${token}">Verify Email Address</a>
        <p>If you didn't create an account, please disregard this email.</p>
        <p>Thanks,<br/>The ${name} Team</p>
      </div>
    `,
  };
  await sendEmail(mailOptions);
  console.log(`Verification email sent to ${email}`);
}

async function sendTestEmail(recipientEmail) {
  const { smtpSettings, name } = await getSMTPSettings();
  const mailOptions = {
    from: `${smtpSettings.fromName} <${smtpSettings.fromAddress}>`,
    to: recipientEmail,
    subject: "Impulse Test Message",
    html: `
      <html>
        <body>
          <h1>Hello from ${name}!</h1>
          <p>This is a test of the email system. You're good to go!</p>
          <p>Regards,<br/>${name}</p>
        </body>
      </html>
    `,
  };
  await sendEmail(mailOptions);
  console.log(`Test email sent to ${recipientEmail}`);
}

async function sendPasswordResetEmail(email, token) {
  const { smtpSettings, name } = await getSMTPSettings();
  const mailOptions = {
    from: `${smtpSettings.fromName} <${smtpSettings.fromAddress}>`,
    to: email,
    subject: "Password Reset Request",
    html: `
      <div>
        <h2>Password Reset Request</h2>
        <p>We received a request to reset your password. Click the button below to reset it:</p>
        <a href="${config.baseUri}/auth/reset/${token}">Reset Password</a>
        <p>If you didn't request a password reset, please ignore this email.</p>
        <p>Thank you,<br/>The ${name} Team</p>
      </div>
    `,
  };
  await sendEmail(mailOptions);
  console.log(`Password reset email sent to ${email}`);
}

module.exports = {
  sendWelcomeEmail,
  sendVerificationEmail,
  sendTestEmail,
  sendPasswordResetEmail,
};
