import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const APP_URL = process.env.APP_URL || "https://rankyatra.in";

const baseStyle = `font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#0f0e17;color:#fffffe;padding:32px;border-radius:14px;`;
const header = `<div style="text-align:center;margin-bottom:20px;"><h1 style="color:#f5a623;margin:0;">RankYatra 🏆</h1></div>`;
const footer = `<hr style="border-color:#2e2d3d;margin:20px 0;"/><p style="color:#a7a9be;font-size:12px;text-align:center;margin:0;">RankYatra — Compete. Rank. Win.</p>`;

function btn(text: string, url: string) {
  return `<div style="text-align:center;margin:24px 0;"><a href="${url}" style="background:#f5a623;color:#0f0e17;padding:12px 32px;border-radius:10px;font-weight:800;font-size:15px;text-decoration:none;">${text}</a></div>`;
}

export async function sendVerificationOtpEmail(toEmail: string, otp: string, name: string) {
  await transporter.sendMail({
    from: `"RankYatra" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: "RankYatra — Verify Your Email Address",
    html: `
      <div style="${baseStyle}">
        ${header}
        <p style="font-size:16px;line-height:1.6;">Hi <strong>${name}</strong>, welcome to RankYatra!</p>
        <p style="font-size:15px;color:#a7a9be;">Please use the OTP below to verify your email address:</p>
        <div style="text-align:center;margin:32px 0;">
          <div style="background:#f5a623;color:#0f0e17;padding:20px 40px;border-radius:12px;font-size:40px;font-weight:900;letter-spacing:10px;display:inline-block;">${otp}</div>
        </div>
        <p style="color:#a7a9be;font-size:14px;text-align:center;">This OTP is valid for <strong>10 minutes</strong>.</p>
        ${footer}
      </div>`,
  });
}

export async function sendDepositConfirmedEmail(toEmail: string, name: string, amount: string, newBalance: string, utrNumber: string) {
  await transporter.sendMail({
    from: `"RankYatra" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: `✅ ₹${amount} Added to Your Wallet — RankYatra`,
    html: `
      <div style="${baseStyle}">
        ${header}
        <h2 style="font-size:20px;">Hello, ${name}!</h2>
        <p style="color:#d4d6e0;">Your wallet deposit has been approved successfully.</p>
        <div style="background:#1a1929;border-radius:12px;padding:20px;margin:20px 0;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="color:#a7a9be;padding:8px 0;font-size:14px;">Amount Added</td><td style="color:#4ade80;font-weight:800;font-size:18px;text-align:right;">+ ₹${amount}</td></tr>
            <tr><td style="color:#a7a9be;padding:8px 0;font-size:14px;">UTR Number</td><td style="color:#fffffe;font-size:14px;text-align:right;">${utrNumber}</td></tr>
            <tr style="border-top:1px solid #2e2d3d;"><td style="color:#a7a9be;padding:12px 0 4px;font-size:14px;">New Wallet Balance</td><td style="color:#f5a623;font-weight:800;font-size:20px;text-align:right;">₹${newBalance}</td></tr>
          </table>
        </div>
        ${btn("Browse Exams →", `${APP_URL}/exams`)}
        ${footer}
      </div>`,
  });
}

export async function sendDepositRejectedEmail(toEmail: string, name: string, amount: string, utrNumber: string, adminNote?: string | null) {
  await transporter.sendMail({
    from: `"RankYatra" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: `❌ Deposit Request Rejected — RankYatra`,
    html: `
      <div style="${baseStyle}">
        ${header}
        <h2 style="font-size:20px;">Hello, ${name}!</h2>
        <p style="color:#d4d6e0;">Unfortunately, your deposit request of ₹${amount} has been rejected.</p>
        <div style="background:#1a1929;border-radius:12px;padding:20px;margin:20px 0;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="color:#a7a9be;padding:8px 0;font-size:14px;">Amount</td><td style="color:#f87171;font-weight:800;font-size:18px;text-align:right;">₹${amount}</td></tr>
            <tr><td style="color:#a7a9be;padding:8px 0;font-size:14px;">UTR Number</td><td style="color:#fffffe;font-size:14px;text-align:right;">${utrNumber}</td></tr>
            ${adminNote ? `<tr><td style="color:#a7a9be;padding:8px 0;font-size:14px;">Reason</td><td style="color:#fbbf24;font-size:14px;text-align:right;">${adminNote}</td></tr>` : ""}
          </table>
        </div>
        <p style="color:#d4d6e0;font-size:14px;">If you believe this is an error, please contact support or try again with the correct UTR number.</p>
        ${footer}
      </div>`,
  });
}

export async function sendContestJoinEmail(toEmail: string, name: string, examTitle: string, entryFee: string, startTime: Date, newBalance: string) {
  const startStr = startTime.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
  await transporter.sendMail({
    from: `"RankYatra" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: `🏆 You have joined the contest — ${examTitle}`,
    html: `
      <div style="${baseStyle}">
        ${header}
        <h2 style="font-size:20px;">Get ready, ${name}!</h2>
        <p style="color:#d4d6e0;">You have successfully registered for the following contest.</p>
        <div style="background:#1a1929;border-radius:12px;padding:20px;margin:20px 0;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="color:#a7a9be;padding:8px 0;font-size:14px;">Contest</td><td style="color:#fffffe;font-weight:700;font-size:15px;text-align:right;">${examTitle}</td></tr>
            <tr><td style="color:#a7a9be;padding:8px 0;font-size:14px;">Entry Fee</td><td style="color:#f87171;font-weight:800;font-size:16px;text-align:right;">- ₹${entryFee}</td></tr>
            <tr><td style="color:#a7a9be;padding:8px 0;font-size:14px;">Starts At</td><td style="color:#fbbf24;font-weight:700;font-size:14px;text-align:right;">${startStr} IST</td></tr>
            <tr style="border-top:1px solid #2e2d3d;"><td style="color:#a7a9be;padding:12px 0 4px;font-size:14px;">Wallet Balance</td><td style="color:#f5a623;font-weight:800;font-size:18px;text-align:right;">₹${newBalance}</td></tr>
          </table>
        </div>
        <p style="color:#d4d6e0;font-size:14px;">Please be on your dashboard when the contest begins. Good luck! 💪</p>
        ${btn("Go to Dashboard →", `${APP_URL}/dashboard`)}
        ${footer}
      </div>`,
  });
}

export async function sendWithdrawalRequestEmail(toEmail: string, name: string, amount: string, method: string, details: string, withdrawalId: number) {
  await transporter.sendMail({
    from: `"RankYatra" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: `💸 Withdrawal Request Received — ₹${amount}`,
    html: `
      <div style="${baseStyle}">
        ${header}
        <h2 style="font-size:20px;">Hello, ${name}!</h2>
        <p style="color:#d4d6e0;">We have received your withdrawal request. Processing may take 24–48 hours.</p>
        <div style="background:#1a1929;border-radius:12px;padding:20px;margin:20px 0;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="color:#a7a9be;padding:8px 0;font-size:14px;">Request ID</td><td style="color:#fffffe;font-size:14px;text-align:right;">#${withdrawalId}</td></tr>
            <tr><td style="color:#a7a9be;padding:8px 0;font-size:14px;">Amount</td><td style="color:#f5a623;font-weight:800;font-size:18px;text-align:right;">₹${amount}</td></tr>
            <tr><td style="color:#a7a9be;padding:8px 0;font-size:14px;">Method</td><td style="color:#fffffe;font-size:14px;text-align:right;">${method === "upi" ? "UPI" : "Bank Transfer"}</td></tr>
            <tr><td style="color:#a7a9be;padding:8px 0;font-size:14px;">Details</td><td style="color:#fffffe;font-size:14px;text-align:right;">${details}</td></tr>
            <tr style="border-top:1px solid #2e2d3d;"><td style="color:#a7a9be;padding:12px 0 4px;font-size:14px;">Status</td><td style="color:#fbbf24;font-weight:700;font-size:15px;text-align:right;">⏳ Pending</td></tr>
          </table>
        </div>
        ${footer}
      </div>`,
  });
}

export async function sendWithdrawalApprovedEmail(toEmail: string, name: string, amount: string, method: string, utrNumber?: string | null) {
  await transporter.sendMail({
    from: `"RankYatra" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: `✅ ₹${amount} Successfully Transferred — RankYatra`,
    html: `
      <div style="${baseStyle}">
        ${header}
        <h2 style="font-size:20px;">Congratulations, ${name}! 🎉</h2>
        <p style="color:#d4d6e0;">Your withdrawal has been approved and the amount has been transferred.</p>
        <div style="background:#1a1929;border-radius:12px;padding:20px;margin:20px 0;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="color:#a7a9be;padding:8px 0;font-size:14px;">Amount Transferred</td><td style="color:#4ade80;font-weight:800;font-size:18px;text-align:right;">₹${amount}</td></tr>
            <tr><td style="color:#a7a9be;padding:8px 0;font-size:14px;">Method</td><td style="color:#fffffe;font-size:14px;text-align:right;">${method === "upi" ? "UPI" : "Bank Transfer"}</td></tr>
            ${utrNumber ? `<tr><td style="color:#a7a9be;padding:8px 0;font-size:14px;">UTR / Reference</td><td style="color:#fffffe;font-size:14px;text-align:right;">${utrNumber}</td></tr>` : ""}
            <tr style="border-top:1px solid #2e2d3d;"><td style="color:#a7a9be;padding:12px 0 4px;font-size:14px;">Status</td><td style="color:#4ade80;font-weight:700;font-size:15px;text-align:right;">✅ Approved</td></tr>
          </table>
        </div>
        ${footer}
      </div>`,
  });
}

export async function sendWithdrawalRejectedEmail(toEmail: string, name: string, amount: string, newBalance: string, adminNote?: string | null) {
  await transporter.sendMail({
    from: `"RankYatra" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: `❌ Withdrawal Rejected — ₹${amount} Refunded to Wallet`,
    html: `
      <div style="${baseStyle}">
        ${header}
        <h2 style="font-size:20px;">Hello, ${name}!</h2>
        <p style="color:#d4d6e0;">Your withdrawal request has been rejected. The amount has been refunded to your wallet.</p>
        <div style="background:#1a1929;border-radius:12px;padding:20px;margin:20px 0;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="color:#a7a9be;padding:8px 0;font-size:14px;">Refunded Amount</td><td style="color:#4ade80;font-weight:800;font-size:18px;text-align:right;">+ ₹${amount}</td></tr>
            ${adminNote ? `<tr><td style="color:#a7a9be;padding:8px 0;font-size:14px;">Reason</td><td style="color:#fbbf24;font-size:14px;text-align:right;">${adminNote}</td></tr>` : ""}
            <tr style="border-top:1px solid #2e2d3d;"><td style="color:#a7a9be;padding:12px 0 4px;font-size:14px;">New Wallet Balance</td><td style="color:#f5a623;font-weight:800;font-size:20px;text-align:right;">₹${newBalance}</td></tr>
          </table>
        </div>
        ${footer}
      </div>`,
  });
}

export async function sendKycApprovedEmail(toEmail: string, name: string) {
  await transporter.sendMail({
    from: `"RankYatra" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: `✅ KYC Approved — You Can Now Withdraw Your Winnings!`,
    html: `
      <div style="${baseStyle}">
        ${header}
        <div style="text-align:center;font-size:64px;margin:16px 0;">✅</div>
        <h2 style="font-size:22px;text-align:center;">Congratulations, ${name}!</h2>
        <p style="color:#d4d6e0;text-align:center;font-size:16px;">Your KYC verification has been successfully approved.</p>
        <div style="background:#1a1929;border-radius:12px;padding:20px;margin:24px 0;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="color:#a7a9be;padding:10px 0;font-size:14px;">KYC Status</td><td style="color:#4ade80;font-weight:800;font-size:16px;text-align:right;">✅ Verified</td></tr>
            <tr><td style="color:#a7a9be;padding:10px 0;font-size:14px;">Withdrawals</td><td style="color:#4ade80;font-weight:700;font-size:14px;text-align:right;">Enabled ✓</td></tr>
            <tr><td style="color:#a7a9be;padding:10px 0;font-size:14px;">Prize Winnings</td><td style="color:#4ade80;font-weight:700;font-size:14px;text-align:right;">Eligible ✓</td></tr>
          </table>
        </div>
        <p style="color:#d4d6e0;font-size:15px;">You can now withdraw your prize winnings directly to your bank or UPI. Join contests and start winning!</p>
        ${btn("View Wallet →", `${APP_URL}/wallet`)}
        ${footer}
      </div>`,
  });
}

export async function sendKycRejectedEmail(toEmail: string, name: string, adminNote?: string | null) {
  await transporter.sendMail({
    from: `"RankYatra" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: `❌ KYC Verification Rejected — RankYatra`,
    html: `
      <div style="${baseStyle}">
        ${header}
        <h2 style="font-size:20px;">Hello, ${name}!</h2>
        <p style="color:#d4d6e0;">Unfortunately, your KYC verification could not be approved at this time.</p>
        <div style="background:#1a1929;border-radius:12px;padding:20px;margin:20px 0;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="color:#a7a9be;padding:10px 0;font-size:14px;">Status</td><td style="color:#f87171;font-weight:800;font-size:16px;text-align:right;">❌ Rejected</td></tr>
            ${adminNote ? `<tr><td style="color:#a7a9be;padding:10px 0;font-size:14px;">Reason</td><td style="color:#fbbf24;font-weight:600;font-size:14px;text-align:right;">${adminNote}</td></tr>` : ""}
          </table>
        </div>
        <p style="color:#d4d6e0;font-size:14px;">Please re-submit with clear, readable documents. Make sure the image quality is good and all details are visible.</p>
        ${btn("Re-submit Documents →", `${APP_URL}/dashboard`)}
        ${footer}
      </div>`,
  });
}

export async function sendPrizeWonEmail(toEmail: string, name: string, examTitle: string, rank: number, prizeAmount: string, newBalance: string) {
  const rankEmoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "🏅";
  await transporter.sendMail({
    from: `"RankYatra" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: `${rankEmoji} Congratulations! You won ₹${prizeAmount} — RankYatra`,
    html: `
      <div style="${baseStyle}">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="color:#f5a623;margin:0;">RankYatra 🏆</h1>
          <div style="font-size:64px;margin:16px 0;">${rankEmoji}</div>
        </div>
        <h2 style="font-size:22px;text-align:center;">Well done, ${name}!</h2>
        <p style="color:#d4d6e0;text-align:center;">You achieved Rank #${rank} in the contest and won a prize!</p>
        <div style="background:#1a1929;border-radius:12px;padding:20px;margin:20px 0;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="color:#a7a9be;padding:8px 0;font-size:14px;">Contest</td><td style="color:#fffffe;font-weight:700;font-size:15px;text-align:right;">${examTitle}</td></tr>
            <tr><td style="color:#a7a9be;padding:8px 0;font-size:14px;">Your Rank</td><td style="color:#f5a623;font-weight:800;font-size:18px;text-align:right;">#${rank} ${rankEmoji}</td></tr>
            <tr><td style="color:#a7a9be;padding:8px 0;font-size:14px;">Prize Amount</td><td style="color:#4ade80;font-weight:800;font-size:20px;text-align:right;">+ ₹${prizeAmount}</td></tr>
            <tr style="border-top:1px solid #2e2d3d;"><td style="color:#a7a9be;padding:12px 0 4px;font-size:14px;">Wallet Balance</td><td style="color:#f5a623;font-weight:800;font-size:20px;text-align:right;">₹${newBalance}</td></tr>
          </table>
        </div>
        ${btn("View Wallet →", `${APP_URL}/wallet`)}
        ${footer}
      </div>`,
  });
}

export async function sendWelcomeEmail(toEmail: string, name: string) {
  await transporter.sendMail({
    from: `"RankYatra" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: "Welcome to RankYatra! 🏆",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0f0e17;color:#fffffe;padding:36px;border-radius:16px;">
        <div style="text-align:center;margin-bottom:28px;">
          <h1 style="color:#f5a623;font-size:32px;margin:0;">RankYatra 🏆</h1>
          <p style="color:#a7a9be;margin-top:6px;font-size:15px;">Compete. Rank. Win.</p>
        </div>
        <h2 style="font-size:22px;color:#fffffe;margin-bottom:8px;">Welcome, ${name}! 🎉</h2>
        <p style="font-size:16px;line-height:1.7;color:#d4d6e0;">
          Your RankYatra account has been successfully verified. You can now participate in live contests and win real cash prizes!
        </p>
        <div style="background:#1a1929;border-radius:12px;padding:24px;margin:28px 0;">
          <h3 style="color:#f5a623;margin:0 0 16px 0;font-size:16px;">How to get started:</h3>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px 0;color:#a7a9be;font-size:14px;">✅</td><td style="padding:8px 0;color:#d4d6e0;font-size:14px;">Browse live contests</td></tr>
            <tr><td style="padding:8px 0;color:#a7a9be;font-size:14px;">💳</td><td style="padding:8px 0;color:#d4d6e0;font-size:14px;">Add funds to your wallet</td></tr>
            <tr><td style="padding:8px 0;color:#a7a9be;font-size:14px;">🏅</td><td style="padding:8px 0;color:#d4d6e0;font-size:14px;">Join a contest and rank high</td></tr>
            <tr><td style="padding:8px 0;color:#a7a9be;font-size:14px;">🎁</td><td style="padding:8px 0;color:#d4d6e0;font-size:14px;">Win cash prizes and withdraw instantly</td></tr>
          </table>
        </div>
        <div style="text-align:center;margin:32px 0;">
          <a href="${APP_URL}/exams" style="background:#f5a623;color:#0f0e17;padding:14px 36px;border-radius:10px;font-weight:800;font-size:16px;text-decoration:none;display:inline-block;">Browse Contests →</a>
        </div>
        <hr style="border-color:#2e2d3d;margin:28px 0;" />
        <p style="color:#a7a9be;font-size:12px;text-align:center;margin:0;">
          RankYatra — India's most exciting competitive exam platform<br/>
          <a href="${APP_URL}" style="color:#f5a623;">rankyatra.in</a>
        </p>
      </div>`,
  });
}

export async function sendGroupInviteEmail(toEmail: string, toName: string, ownerName: string, groupName: string) {
  await transporter.sendMail({
    from: `"RankYatra" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: `🎉 ${ownerName} ne aapko Group Invite kiya — RankYatra`,
    html: `
      <div style="${baseStyle}">
        ${header}
        <h2 style="font-size:20px;">Hello, ${toName}!</h2>
        <p style="color:#d4d6e0;font-size:15px;line-height:1.6;">
          <strong style="color:#f5a623;">${ownerName}</strong> ne aapko
          <strong style="color:#fffffe;">"${groupName}"</strong> group mein invite kiya hai.
        </p>
        <p style="color:#a7a9be;font-size:14px;">
          Group join karne se aapki sabhi exam activities track hoti hain aur teacher/promoter aapki progress dekh sakta hai.
        </p>
        ${btn("App Open Karo & Accept Karo →", `${APP_URL}`)}
        <p style="color:#a7a9be;font-size:12px;text-align:center;">
          RankYatra app mein Group Dashboard mein jaake invite accept ya decline kar sakte hain.
        </p>
        ${footer}
      </div>`,
  });
}

export async function sendPasswordResetEmail(toEmail: string, resetLink: string) {
  await transporter.sendMail({
    from: `"RankYatra" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: "Reset Your RankYatra Password",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#0f0e17;color:#fffffe;padding:32px;border-radius:12px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="color:#f5a623;font-size:28px;margin:0;">RankYatra 🏆</h1>
          <p style="color:#a7a9be;margin-top:6px;">Password Reset Request</p>
        </div>
        <p style="font-size:16px;line-height:1.6;">
          We received a request to reset your password. Click the button below to set a new password.
        </p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${resetLink}" style="background:#f5a623;color:#0f0e17;padding:14px 32px;border-radius:8px;font-weight:700;font-size:16px;text-decoration:none;display:inline-block;">Reset Password</a>
        </div>
        <p style="color:#a7a9be;font-size:14px;">
          This link is valid for <strong>1 hour</strong>. If you did not request this, please ignore this email.
        </p>
        <hr style="border-color:#2e2d3d;margin:24px 0;" />
        <p style="color:#a7a9be;font-size:12px;text-align:center;margin:0;">RankYatra — Compete. Rank. Win.</p>
      </div>`,
  });
}
