# Email Service Setup Guide

## 🚀 Quick Setup with Gmail (Recommended)

### Step 1: Enable 2-Factor Authentication
1. Go to your Google Account settings
2. Enable 2-Factor Authentication if not already enabled

### Step 2: Generate App Password
1. Go to [Google App Passwords](https://myaccount.google.com/apppasswords)
2. Select "Mail" and "Other (custom name)"
3. Enter "PFIMS Backend" as the name
4. Copy the generated 16-character password

### Step 3: Update .env File
```env
# Email Configuration (Gmail)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-16-char-app-password
```

## 🧪 Mailtrap Setup (For Testing) - DETAILED STEPS

Perfect for development - catches emails without sending them.

### Step-by-Step Mailtrap Setup:

1. **Sign up at Mailtrap.io**
   - Go to [https://mailtrap.io](https://mailtrap.io)
   - Click "Sign Up" (top right)
   - Use your email or sign up with Google/GitHub

2. **After signing up, you'll see the dashboard**
   - Look for "Email Testing" section
   - Click "Start Testing" button

3. **Create your first inbox**
   - You'll be taken to the inbox creation page
   - Give it a name like "PFIMS Testing"
   - Click "Create Inbox"

4. **Get your SMTP credentials**
   - Once inbox is created, click on it
   - Look for "SMTP Settings" tab
   - You'll see credentials like:
     ```
     Host: sandbox.smtp.mailtrap.io
     Port: 2525
     Username: [your-username]
     Password: [your-password]
     ```

5. **Copy these exact credentials to your .env file**

```env
# Email Configuration (Mailtrap - Testing)
EMAIL_HOST=sandbox.smtp.mailtrap.io
EMAIL_PORT=2525
EMAIL_SECURE=false
EMAIL_USER=your-actual-mailtrap-username
EMAIL_PASS=your-actual-mailtrap-password
```

## 🌟 Alternative: Outlook

```env
# Email Configuration (Outlook)
EMAIL_HOST=smtp-mail.outlook.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@outlook.com
EMAIL_PASS=your-outlook-password
```

## 🔧 Alternative: SendGrid

1. Sign up at [SendGrid](https://sendgrid.com)
2. Create an API key
3. Use API key as password

```env
# Email Configuration (SendGrid)
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=apikey
EMAIL_PASS=your-sendgrid-api-key
```

## ✅ Testing Your Setup

After updating your .env file, restart the server and check the logs:
- ✅ "Email service configured successfully"
- ✅ "Email server connection verified"

## 🚨 Troubleshooting

### Gmail Issues:
- Make sure 2FA is enabled
- Use App Password, not regular password
- Check "Less secure app access" is disabled (use App Password instead)

### General Issues:
- Verify .env file is in the backend directory
- Restart the server after changing .env
- Check firewall/antivirus blocking SMTP ports