const nodemailer = require('nodemailer');
const crypto = require('crypto');
const ExcelJS = require('exceljs');

class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.initializeTransporter();
  }

  initializeTransporter() {
    try {
      const emailUser = process.env.EMAIL_USER;
      const emailPass = process.env.EMAIL_PASS;
      const emailHost = process.env.EMAIL_HOST || 'smtp.gmail.com';
      const emailPort = Number(process.env.EMAIL_PORT || 465);
      const emailSecure = process.env.EMAIL_SECURE ? process.env.EMAIL_SECURE === 'true' : true;

      if (!emailUser || !emailPass) {
        console.warn('⚠️ Email configuration not found. Email features will be disabled.');
        return;
      }

      this.transporter = nodemailer.createTransport({
        host: emailHost,
        port: emailPort,
        secure: emailSecure,
        auth: {
          user: emailUser,
          pass: emailPass,
        },
        tls: {
          rejectUnauthorized: process.env.NODE_ENV === 'production'
        }
      });

      this.isConfigured = true;
      console.log(`✅ Gmail SMTP email service configured (${emailHost}:${emailPort}, secure=${emailSecure})`);
      console.log(`📨 Emails will be sent from ${process.env.EMAIL_FROM || emailUser}`);
    } catch (error) {
      console.error('❌ Failed to configure email service:', error.message);
      this.isConfigured = false;
    }
  }

  async verifyConnection() {
    if (!this.isConfigured) {
      return false;
    }

    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      console.log('✅ Gmail SMTP connection verified');
      return true;
    } catch (error) {
      console.error('❌ Gmail SMTP connection failed:', error.message);
      return false;
    }
  }

  async sendEmail(to, subject, html, text = null, options = {}) {
    if (text && typeof text === 'object' && !Array.isArray(text)) {
      options = text;
      text = null;
    }
    if (!this.isConfigured) {
      console.warn('⚠️ Email service not configured. Skipping email send.');
      return { success: false, error: 'Email service not configured' };
    }

    if (!this.transporter) {
      return { success: false, error: 'No SMTP transporter configured' };
    }

    try {
      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME || 'PFIMS'}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
        to,
        subject,
        html,
        text: text || this.stripHtml(html),
        ...(options?.attachments ? { attachments: options.attachments } : {})
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Email sent to ${to}: ${info.messageId}`);
      return { success: true, messageId: info.messageId, response: info.response };
    } catch (error) {
      console.error(`❌ Failed to send email to ${to}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async sendVerificationEmail(user, verificationToken) {
    const verificationUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email</title>
        <style>
          body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #0f172a; }
          .container { max-width: 640px; margin: 24px auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
          .header { background: #1f2937; color: #ffffff; padding: 20px; }
          .content { padding: 24px; }
          .button { display: inline-block; padding: 12px 16px; background: #6366f1; color: #ffffff; border-radius: 8px; text-decoration: none; }
          .footer { padding: 16px 24px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Verify Your Email</h1>
          </div>
          <div class="content">
            <p>Hi ${user.firstName || 'there'},</p>
            <p>Thanks for signing up for PFIMS. Please confirm your email address by clicking the button below.</p>
            <div style="text-align:center; margin: 24px 0;">
              <a href="${verificationUrl}" class="button">Verify Email Address</a>
            </div>
            <p>If the button doesn't work, copy and paste this link:</p>
            <p style="word-break: break-all; color: #6366f1;">${verificationUrl}</p>
            <p><strong>This link expires in 24 hours.</strong></p>
          </div>
          <div class="footer">
            <p>&copy; 2024 PFIMS. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(
      user.email,
      'Verify Your Email Address - PFIMS',
      html
    );
  }

  async sendPasswordReset(user, resetToken) {
    const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
        <style>
          body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #0f172a; }
          .container { max-width: 640px; margin: 24px auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
          .header { background: #ef4444; color: #ffffff; padding: 20px; }
          .content { padding: 24px; }
          .button { display: inline-block; padding: 12px 16px; background: #ef4444; color: #ffffff; border-radius: 8px; text-decoration: none; }
          .warning { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 12px; border-radius: 8px; margin: 16px 0; }
          .footer { padding: 16px 24px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset</h1>
          </div>
          <div class="content">
            <p>We received a request to reset your password for your PFIMS account. If you made this request, click the button below to reset your password:</p>
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </div>
            <p>If the button doesn't work, copy and paste this link:</p>
            <p style="word-break: break-all; color: #ef4444;">${resetUrl}</p>
            <div class="warning">
              <p><strong>Important:</strong> This link will expire in 1 hour.</p>
            </div>
          </div>
          <div class="footer">
            <p>&copy; 2024 PFIMS. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(
      user.email,
      'Reset Your Password - PFIMS',
      html
    );
  }

  async sendPasswordResetEmail(user, resetToken) {
    return await this.sendPasswordReset(user, resetToken);
  }

  async sendBudgetAlertEmail(user, budget, category, alertType) {
    const dashboardUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard`;

    const alertMessages = {
      threshold: 'You are approaching your budget limit for this category.',
      over_budget: 'You have exceeded your budget for this category.'
    };

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Budget Alert</title>
        <style>
          body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #0f172a; }
          .container { max-width: 640px; margin: 24px auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
          .header { background: #1f2937; color: #ffffff; padding: 20px; }
          .content { padding: 24px; }
          .alert-box { background: #fef3c7; border: 1px solid #fde68a; color: #92400e; padding: 12px; border-radius: 8px; margin: 16px 0; }
          .button { display: inline-block; padding: 12px 16px; background: #6366f1; color: #ffffff; border-radius: 8px; text-decoration: none; }
          .footer { padding: 16px 24px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚨 Budget Alert</h1>
          </div>
          <div class="content">
            <h2>Hi ${user.firstName},</h2>
            <div class="alert-box">
              <p><strong>${alertMessages[alertType]}</strong></p>
              <p>Budget: ${budget.name}</p>
              <p>Category: ${category.name}</p>
              <p>Spent: ${user.currency} ${category.spentAmount.toFixed(2)} / ${user.currency} ${category.budgetAmount.toFixed(2)}</p>
            </div>
            <p>We recommend reviewing your spending and adjusting your budget if necessary.</p>
            <div style="text-align: center;">
              <a href="${dashboardUrl}" class="button">View Dashboard</a>
            </div>
          </div>
          <div class="footer">
            <p>&copy; 2024 PFIMS. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(
      user.email,
      `Budget Alert: ${category.name} - PFIMS`,
      html
    );
  }

  async sendTransactionNotificationEmail(user, transaction) {
    const dashboardUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard`;
    const transactionType = transaction.type === 'income' ? 'Income' : 'Expense';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Transaction Notification</title>
        <style>
          body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #0f172a; }
          .container { max-width: 640px; margin: 24px auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
          .header { background: #1f2937; color: #ffffff; padding: 20px; }
          .content { padding: 24px; }
          .details { background: #f1f5f9; border: 1px solid #e2e8f0; color: #0f172a; padding: 12px; border-radius: 8px; margin: 16px 0; }
          .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #e2e8f0; }
          .detail-row:last-child { border-bottom: none; }
          .detail-label { color: #475569; }
          .button { display: inline-block; padding: 12px 16px; background: #6366f1; color: #ffffff; border-radius: 8px; text-decoration: none; }
          .footer { padding: 16px 24px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${transactionType} Recorded</h1>
          </div>
          <div class="content">
            <div class="details">
              <div class="detail-row">
                <span class="detail-label">Amount:</span>
                <span>${user.currency} ${Math.abs(transaction.amount).toFixed(2)}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Category:</span>
                <span>${transaction.categoryName || (transaction.category && transaction.category.name) || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Date:</span>
                <span>${new Date(transaction.date).toLocaleDateString()}</span>
              </div>
              ${transaction.paymentMethod ? `
              <div class="detail-row">
                <span class="detail-label">Payment Method:</span>
                <span>${transaction.paymentMethod}</span>
              </div>
              ` : ''}
            </div>
            
            <p>Keep track of your finances and stay within your budget goals.</p>
            <div style="text-align: center;">
              <a href="${dashboardUrl}" class="button">View Dashboard</a>
            </div>
          </div>
          <div class="footer">
            <p>&copy; 2024 PFIMS. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(
      user.email,
      `${transactionType} Recorded: ${user.currency} ${Math.abs(transaction.amount).toFixed(2)} - PFIMS`,
      html
    );
  }

  async sendOtpEmail(to, otpCode, expiresMinutes = 10) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your OTP Code</title>
        <style>
          body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #0f172a; }
          .container { max-width: 520px; margin: 24px auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
          .header { background: #1f2937; color: #ffffff; padding: 16px; }
          .content { padding: 24px; }
          .otp { font-size: 32px; font-weight: 700; letter-spacing: 6px; background: #f1f5f9; border: 1px solid #e2e8f0; padding: 12px 16px; border-radius: 8px; text-align: center; }
          .note { color: #64748b; font-size: 13px; margin-top: 12px; }
          .footer { padding: 16px 24px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>OTP Verification</h1>
          </div>
          <div class="content">
            <p>Use the code below to complete your verification:</p>
            <div class="otp">${otpCode}</div>
            <p class="note">This code expires in ${expiresMinutes} minutes.</p>
            <p class="note">If you did not request this code, you can safely ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 PFIMS. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(to, 'Your OTP Code - PFIMS', html);
  }

  generateReportHtml(user, report, period) {
    const title = period === 'weekly' ? 'Weekly Financial Summary' : 'Monthly Financial Summary';
    const { summary, topCategories, periodRange } = report;

    const topCategoriesRows = (topCategories || []).map(cat => `
      <tr>
        <td style="padding:8px; border-bottom:1px solid #e2e8f0;">${cat.categoryName}</td>
        <td style="padding:8px; border-bottom:1px solid #e2e8f0; text-align:right;">${user.currency} ${cat.total.toFixed(2)}</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
          body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #0f172a; }
          .container { max-width: 720px; margin: 24px auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
          .header { background: #1f2937; color: #ffffff; padding: 20px; }
          .content { padding: 24px; }
          .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 16px 0; }
          .card { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
          .label { font-size: 12px; color: #64748b; }
          .value { font-size: 18px; font-weight: 700; margin-top: 6px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          .footer { padding: 16px 24px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${title}</h1>
            <p style="margin:4px 0; color:#e5e7eb;">${new Date(periodRange.start).toLocaleDateString()} – ${new Date(periodRange.end).toLocaleDateString()}</p>
          </div>
          <div class="content">
            <h2 style="margin:0 0 8px;">Overview</h2>
            <div class="summary">
              <div class="card"><div class="label">Income</div><div class="value">${user.currency} ${(summary.income || 0).toFixed(2)}</div></div>
              <div class="card"><div class="label">Expenses</div><div class="value">${user.currency} ${(summary.expense || 0).toFixed(2)}</div></div>
              <div class="card"><div class="label">Net</div><div class="value">${user.currency} ${(summary.netIncome || 0).toFixed(2)}</div></div>
            </div>

            <h2 style="margin:16px 0 8px;">Top Expense Categories</h2>
            <table>
              <thead>
                <tr>
                  <th style="text-align:left; padding:8px; border-bottom:2px solid #e2e8f0;">Category</th>
                  <th style="text-align:right; padding:8px; border-bottom:2px solid #e2e8f0;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${topCategoriesRows || '<tr><td colspan="2" style="padding:12px; text-align:center; color:#64748b;">No expense categories</td></tr>'}
              </tbody>
            </table>
          </div>
          <div class="footer">
            <p>&copy; 2024 PFIMS. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return html;
  }

  async generateReportXlsxBuffer(user, report, period) {
    const title = period === 'weekly' ? 'Weekly Financial Summary' : 'Monthly Financial Summary';
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PFIMS';
    workbook.created = new Date();

    const summarySheet = workbook.addWorksheet('Summary', { views: [{ state: 'frozen', ySplit: 4 }] });
    summarySheet.getCell('A1').value = title;
    summarySheet.getCell('A1').font = { size: 16, bold: true };

    const startLabel = report?.periodRange?.start ? new Date(report.periodRange.start).toLocaleDateString() : '';
    const endLabel = report?.periodRange?.end ? new Date(report.periodRange.end).toLocaleDateString() : '';
    summarySheet.getCell('A2').value = startLabel && endLabel ? `${startLabel} – ${endLabel}` : '';
    summarySheet.getCell('A2').font = { color: { argb: 'FF64748B' } };

    summarySheet.getCell('A4').value = 'Currency';
    summarySheet.getCell('B4').value = user.currency || '';

    summarySheet.getCell('A6').value = 'Income';
    summarySheet.getCell('B6').value = Number(report?.summary?.income || 0);
    summarySheet.getCell('A7').value = 'Expenses';
    summarySheet.getCell('B7').value = Number(report?.summary?.expense || 0);
    summarySheet.getCell('A8').value = 'Net Income';
    summarySheet.getCell('B8').value = { formula: 'B6-B7' };
    summarySheet.getCell('A9').value = 'Savings Rate';
    summarySheet.getCell('B9').value = { formula: 'IF(B6=0,0,B8/B6)' };
    summarySheet.getCell('A10').value = 'Transactions';
    summarySheet.getCell('B10').value = Number(report?.summary?.transactionCount || 0);

    ['B6', 'B7', 'B8'].forEach((addr) => {
      summarySheet.getCell(addr).numFmt = '#,##0.00';
    });
    summarySheet.getCell('B9').numFmt = '0.00%';

    for (let r = 6; r <= 10; r += 1) {
      summarySheet.getCell(`A${r}`).font = { bold: true };
    }

    summarySheet.columns = [
      { key: 'label', width: 22 },
      { key: 'value', width: 18 },
    ];

    const categoriesSheet = workbook.addWorksheet('Top Categories', { views: [{ state: 'frozen', ySplit: 1 }] });
    categoriesSheet.columns = [
      { header: 'Category', key: 'categoryName', width: 28 },
      { header: 'Amount', key: 'total', width: 16, style: { numFmt: '#,##0.00' } },
    ];
    categoriesSheet.getRow(1).font = { bold: true };

    const topCategories = Array.isArray(report?.topCategories) ? report.topCategories : [];
    topCategories.forEach((c) => {
      categoriesSheet.addRow({
        categoryName: c?.categoryName || 'N/A',
        total: Number(c?.total || 0),
      });
    });

    const totalRowIndex = Math.max(2, topCategories.length + 2);
    categoriesSheet.getCell(`A${totalRowIndex}`).value = 'Total';
    categoriesSheet.getCell(`A${totalRowIndex}`).font = { bold: true };
    const sumStart = 2;
    const sumEnd = Math.max(2, totalRowIndex - 1);
    categoriesSheet.getCell(`B${totalRowIndex}`).value = { formula: `SUM(B${sumStart}:B${sumEnd})` };
    categoriesSheet.getCell(`B${totalRowIndex}`).font = { bold: true };
    categoriesSheet.getCell(`B${totalRowIndex}`).numFmt = '#,##0.00';

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async sendReportEmail(user, report, period, options = {}) {
    const subject = period === 'weekly' ? 'Weekly Financial Summary - PFIMS' : 'Monthly Financial Summary - PFIMS';
    const html = this.generateReportHtml(user, report, period);
    return await this.sendEmail(user.email, subject, html, null, options);
  }

  stripHtml(html) {
    return (html || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  generateSecureToken() {
    return crypto.randomBytes(32).toString('hex');
  }
}

// Create singleton instance
const emailService = new EmailService();

module.exports = emailService;
