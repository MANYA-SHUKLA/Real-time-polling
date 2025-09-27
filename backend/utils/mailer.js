const nodemailer = require('nodemailer');

let transporter = null;

// Check if all required email environment variables are present
function canSendEmail() {
  return !!(
    process.env.EMAIL_SERVICE && 
    process.env.EMAIL_USERNAME && 
    process.env.EMAIL_PASSWORD && 
    process.env.EMAIL_FROM
  );
}

// Get or create nodemailer transporter
function getTransporter() {
  if (!transporter) {
    if (process.env.EMAIL_SERVICE === 'gmail') {
      // Gmail-specific configuration
      transporter = nodemailer.createTransporter({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USERNAME,
          pass: process.env.EMAIL_PASSWORD
        }
      });
    } else {
      // Generic SMTP configuration (fallback)
      transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: Number(process.env.SMTP_PORT || 587),
        secure: Number(process.env.SMTP_PORT || 587) === 465,
        auth: {
          user: process.env.EMAIL_USERNAME || process.env.SMTP_USER,
          pass: process.env.EMAIL_PASSWORD || process.env.SMTP_PASS
        }
      });
    }
  }
  return transporter;
}

// Build email content based on event type
function buildEmailContent(event, payload) {
  const userName = payload.name || 'User';
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  
  // Common email wrapper styles
  const emailWrapper = `
    <div style="
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      max-width: 600px;
      margin: 0 auto;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0,0,0,0.1);
    ">
      <div style="background: white; margin: 3px; border-radius: 17px; overflow: hidden;">
  `;
  
  const emailFooter = `
        <div style="background: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
          <div style="margin-bottom: 20px;">
            <div style="
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              width: 50px;
              height: 50px;
              border-radius: 50%;
              margin: 0 auto 15px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: bold;
              font-size: 20px;
            ">📊</div>
            <h3 style="color: #495057; margin: 0; font-size: 16px;">Real-Time Polling</h3>
          </div>
          <p style="color: #6c757d; font-size: 14px; margin: 0; line-height: 1.5;">
            This is an automated message. Please do not reply to this email.<br>
            <a href="${baseUrl}" style="color: #667eea; text-decoration: none;">Visit Real-Time Polling</a>
          </p>
        </div>
      </div>
    </div>
  `;
  
  const buttonStyle = (color = '#667eea', hoverColor = '#5a67d8') => `
    background: linear-gradient(135deg, ${color} 0%, ${hoverColor} 100%);
    color: white;
    padding: 14px 28px;
    text-decoration: none;
    border-radius: 50px;
    font-weight: 600;
    font-size: 14px;
    display: inline-block;
    margin: 20px 0;
    box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);
    transition: transform 0.2s ease;
  `;
  
  const contentMap = {
    password_changed: {
      subject: '🔐 Password Changed Successfully - Real-Time Polling',
      text: `Hi ${userName},\n\nYour password has been successfully changed. If this wasn't you, please reset your password immediately.\n\nBest regards,\nReal-Time Polling Team`,
      html: `
        ${emailWrapper}
          <div style="padding: 40px; text-align: center;">
            <div style="
              background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
              width: 80px;
              height: 80px;
              border-radius: 50%;
              margin: 0 auto 30px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 35px;
            ">🔐</div>
            <h1 style="color: #212529; margin: 0 0 20px; font-size: 28px; font-weight: 700;">
              Password Changed Successfully!
            </h1>
            <p style="color: #495057; font-size: 18px; line-height: 1.6; margin: 0 0 15px;">
              Hi <strong>${userName}</strong>,
            </p>
            <p style="color: #6c757d; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
              Your password has been successfully updated. Your account is now more secure.
            </p>
            <div style="
              background: #fff3cd;
              border: 2px solid #ffeaa7;
              border-radius: 15px;
              padding: 20px;
              margin: 30px 0;
            ">
              <p style="color: #856404; margin: 0; font-weight: 600;">⚠️ Didn't make this change?</p>
              <p style="color: #856404; margin: 10px 0 0; font-size: 14px;">
                If this wasn't you, please reset your password immediately and contact support.
              </p>
            </div>
            <a href="${baseUrl}/login" style="${buttonStyle('#28a745', '#218838')}">
              🚀 Go to Login
            </a>
          </div>
        ${emailFooter}
      `
    },
    
    profile_updated: {
      subject: '👤 Profile Updated Successfully - Real-Time Polling',
      text: `Hi ${userName},\n\nYour profile has been updated successfully. Changed fields: ${payload.changedFields?.join(', ') || 'N/A'}.\n\nBest regards,\nReal-Time Polling Team`,
      html: `
        ${emailWrapper}
          <div style="padding: 40px; text-align: center;">
            <div style="
              background: linear-gradient(135deg, #17a2b8 0%, #6f42c1 100%);
              width: 80px;
              height: 80px;
              border-radius: 50%;
              margin: 0 auto 30px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 35px;
            ">👤</div>
            <h1 style="color: #212529; margin: 0 0 20px; font-size: 28px; font-weight: 700;">
              Profile Updated!
            </h1>
            <p style="color: #495057; font-size: 18px; line-height: 1.6; margin: 0 0 15px;">
              Hi <strong>${userName}</strong>,
            </p>
            <p style="color: #6c757d; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
              Your profile information has been successfully updated.
            </p>
            <div style="
              background: #d1ecf1;
              border: 2px solid #b8daff;
              border-radius: 15px;
              padding: 25px;
              margin: 30px 0;
            ">
              <h3 style="color: #0c5460; margin: 0 0 15px; font-size: 16px;">📝 Updated Fields:</h3>
              <div style="
                background: white;
                padding: 15px;
                border-radius: 10px;
                border-left: 4px solid #17a2b8;
              ">
                ${payload.changedFields?.map(field => 
                  `<span style="
                    background: #e3f2fd;
                    color: #1565c0;
                    padding: 8px 16px;
                    border-radius: 20px;
                    font-size: 14px;
                    font-weight: 600;
                    margin: 5px;
                    display: inline-block;
                  ">${field.charAt(0).toUpperCase() + field.slice(1)}</span>`
                ).join('') || '<span style="color: #6c757d;">No specific fields</span>'}
              </div>
            </div>
            <a href="${baseUrl}/profile" style="${buttonStyle('#17a2b8', '#138496')}">
              👁️ View Profile
            </a>
          </div>
        ${emailFooter}
      `
    },
    
    poll_created: {
      subject: `📊 ${payload.status === 'published' ? 'Poll Created & Published!' : 'Poll Draft Created'} - Real-Time Polling`,
      text: `Hi ${userName},\n\nYour poll "${payload.question}" has been created as a ${payload.status}.\n\nBest regards,\nReal-Time Polling Team`,
      html: `
        ${emailWrapper}
          <div style="padding: 40px; text-align: center;">
            <div style="
              background: ${payload.status === 'published' ? 
                'linear-gradient(135deg, #28a745 0%, #20c997 100%)' : 
                'linear-gradient(135deg, #ffc107 0%, #fd7e14 100%)'
              };
              width: 80px;
              height: 80px;
              border-radius: 50%;
              margin: 0 auto 30px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 35px;
            ">${payload.status === 'published' ? '🚀' : '📝'}</div>
            <h1 style="color: #212529; margin: 0 0 20px; font-size: 28px; font-weight: 700;">
              ${payload.status === 'published' ? 'Poll Created & Published!' : 'Poll Draft Created!'}
            </h1>
            <p style="color: #495057; font-size: 18px; line-height: 1.6; margin: 0 0 15px;">
              Hi <strong>${userName}</strong>,
            </p>
            <p style="color: #6c757d; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
              ${payload.status === 'published' ? 
                'Great news! Your poll is now live and ready for responses.' : 
                'Your poll has been saved as a draft. You can edit and publish it later.'
              }
            </p>
            <div style="
              background: ${payload.status === 'published' ? '#d4edda' : '#fff3cd'};
              border: 2px solid ${payload.status === 'published' ? '#c3e6cb' : '#ffeaa7'};
              border-radius: 15px;
              padding: 25px;
              margin: 30px 0;
              text-align: left;
            ">
              <h3 style="color: ${payload.status === 'published' ? '#155724' : '#856404'}; margin: 0 0 15px; font-size: 16px;">
                📋 Poll Question:
              </h3>
              <p style="
                color: ${payload.status === 'published' ? '#155724' : '#856404'};
                font-size: 18px;
                font-weight: 600;
                margin: 0;
                font-style: italic;
                line-height: 1.4;
              ">"${payload.question}"</p>
              <div style="margin-top: 15px;">
                <span style="
                  background: ${payload.status === 'published' ? '#28a745' : '#ffc107'};
                  color: white;
                  padding: 6px 12px;
                  border-radius: 20px;
                  font-size: 12px;
                  font-weight: 600;
                  text-transform: uppercase;
                ">${payload.status}</span>
              </div>
            </div>
            ${payload.status === 'published' ? 
              `<a href="${baseUrl}/polls/${payload.pollId}" style="${buttonStyle('#28a745', '#218838')}">
                📊 View Live Poll
              </a>` : 
              `<a href="${baseUrl}/my-polls" style="${buttonStyle('#ffc107', '#e0a800')}">
                ✏️ Manage Drafts
              </a>`
            }
          </div>
        ${emailFooter}
      `
    },
    
    poll_updated: {
      subject: '✏️ Poll Updated Successfully - Real-Time Polling',
      text: `Hi ${userName},\n\nYour poll "${payload.question}" has been updated successfully.\n\nBest regards,\nReal-Time Polling Team`,
      html: `
        ${emailWrapper}
          <div style="padding: 40px; text-align: center;">
            <div style="
              background: linear-gradient(135deg, #007bff 0%, #6610f2 100%);
              width: 80px;
              height: 80px;
              border-radius: 50%;
              margin: 0 auto 30px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 35px;
            ">✏️</div>
            <h1 style="color: #212529; margin: 0 0 20px; font-size: 28px; font-weight: 700;">
              Poll Updated Successfully!
            </h1>
            <p style="color: #495057; font-size: 18px; line-height: 1.6; margin: 0 0 15px;">
              Hi <strong>${userName}</strong>,
            </p>
            <p style="color: #6c757d; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
              Your poll has been updated with the latest changes and is ready to go.
            </p>
            <div style="
              background: #e7f1ff;
              border: 2px solid #b8daff;
              border-radius: 15px;
              padding: 25px;
              margin: 30px 0;
              text-align: left;
            ">
              <h3 style="color: #004085; margin: 0 0 15px; font-size: 16px;">📝 Updated Poll:</h3>
              <p style="
                color: #004085;
                font-size: 18px;
                font-weight: 600;
                margin: 0;
                font-style: italic;
                line-height: 1.4;
              ">"${payload.question}"</p>
              <div style="margin-top: 15px;">
                <span style="
                  background: #007bff;
                  color: white;
                  padding: 6px 12px;
                  border-radius: 20px;
                  font-size: 12px;
                  font-weight: 600;
                ">🔄 UPDATED</span>
              </div>
            </div>
            <a href="${baseUrl}/polls/${payload.pollId}" style="${buttonStyle('#007bff', '#0056b3')}">
              👁️ View Updated Poll
            </a>
          </div>
        ${emailFooter}
      `
    },
    
    poll_published: {
      subject: '🎉 Your Poll is Now LIVE! - Real-Time Polling',
      text: `Hi ${userName},\n\nGreat news! Your poll "${payload.question}" has been published and is now live for voting.\n\nBest regards,\nReal-Time Polling Team`,
      html: `
        ${emailWrapper}
          <div style="padding: 40px; text-align: center;">
            <div style="
              background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
              width: 100px;
              height: 100px;
              border-radius: 50%;
              margin: 0 auto 30px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 45px;
              animation: pulse 2s infinite;
            ">🎉</div>
            <h1 style="
              color: #212529;
              margin: 0 0 10px;
              font-size: 32px;
              font-weight: 700;
              background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
            ">
              Poll is Now LIVE!
            </h1>
            <p style="color: #28a745; font-size: 16px; font-weight: 600; margin: 0 0 20px;">
              🚀 Ready for votes
            </p>
            <p style="color: #495057; font-size: 18px; line-height: 1.6; margin: 0 0 15px;">
              Hi <strong>${userName}</strong>,
            </p>
            <p style="color: #6c757d; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
              Fantastic! Your poll is now published and accepting responses from participants.
            </p>
            <div style="
              background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
              border: 2px solid #28a745;
              border-radius: 20px;
              padding: 30px;
              margin: 30px 0;
              text-align: left;
              position: relative;
              overflow: hidden;
            ">
              <div style="
                position: absolute;
                top: -50%;
                right: -20px;
                width: 100px;
                height: 100px;
                background: rgba(40, 167, 69, 0.1);
                border-radius: 50%;
              "></div>
              <h3 style="color: #155724; margin: 0 0 15px; font-size: 18px; display: flex; align-items: center;">
                📊 <span style="margin-left: 10px;">Live Poll Question:</span>
              </h3>
              <p style="
                color: #155724;
                font-size: 20px;
                font-weight: 700;
                margin: 0 0 20px;
                font-style: italic;
                line-height: 1.3;
              ">"${payload.question}"</p>
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span style="
                  background: #28a745;
                  color: white;
                  padding: 8px 16px;
                  border-radius: 25px;
                  font-size: 14px;
                  font-weight: 600;
                ">🔴 LIVE NOW</span>
                <span style="color: #155724; font-size: 14px;">Ready for responses!</span>
              </div>
            </div>
            <div style="margin: 30px 0;">
              <a href="${baseUrl}/polls/${payload.pollId}" style="${buttonStyle('#28a745', '#218838')} margin-right: 15px;">
                📊 View Live Poll
              </a>
              <a href="${baseUrl}/my-polls" style="${buttonStyle('#17a2b8', '#138496')}">
                📈 Poll Analytics
              </a>
            </div>
          </div>
        ${emailFooter}
      `
    },
    
    poll_unpublished: {
      subject: '📴 Poll Unpublished - Real-Time Polling',
      text: `Hi ${userName},\n\nYour poll "${payload.question}" has been unpublished and is no longer accepting votes.\n\nBest regards,\nReal-Time Polling Team`,
      html: `
        ${emailWrapper}
          <div style="padding: 40px; text-align: center;">
            <div style="
              background: linear-gradient(135deg, #ffc107 0%, #fd7e14 100%);
              width: 80px;
              height: 80px;
              border-radius: 50%;
              margin: 0 auto 30px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 35px;
            ">📴</div>
            <h1 style="color: #212529; margin: 0 0 20px; font-size: 28px; font-weight: 700;">
              Poll Unpublished
            </h1>
            <p style="color: #495057; font-size: 18px; line-height: 1.6; margin: 0 0 15px;">
              Hi <strong>${userName}</strong>,
            </p>
            <p style="color: #6c757d; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
              Your poll has been unpublished and is no longer accepting new responses.
            </p>
            <div style="
              background: #fff3cd;
              border: 2px solid #ffeaa7;
              border-radius: 15px;
              padding: 25px;
              margin: 30px 0;
              text-align: left;
            ">
              <h3 style="color: #856404; margin: 0 0 15px; font-size: 16px;">📋 Unpublished Poll:</h3>
              <p style="
                color: #856404;
                font-size: 18px;
                font-weight: 600;
                margin: 0 0 15px;
                font-style: italic;
                line-height: 1.4;
              ">"${payload.question}"</p>
              <div>
                <span style="
                  background: #856404;
                  color: white;
                  padding: 6px 12px;
                  border-radius: 20px;
                  font-size: 12px;
                  font-weight: 600;
                ">📴 UNPUBLISHED</span>
              </div>
              <p style="color: #856404; font-size: 14px; margin: 15px 0 0; line-height: 1.4;">
                💡 <strong>Note:</strong> You can republish this poll anytime from your dashboard.
              </p>
            </div>
            <a href="${baseUrl}/my-polls" style="${buttonStyle('#ffc107', '#e0a800')}">
              🔧 Manage Polls
            </a>
          </div>
        ${emailFooter}
      `
    },
    
    poll_deleted: {
      subject: '🗑️ Poll Deleted - Real-Time Polling',
      text: `Hi ${userName},\n\nYour poll "${payload.question}" has been permanently deleted.\n\nBest regards,\nReal-Time Polling Team`,
      html: `
        ${emailWrapper}
          <div style="padding: 40px; text-align: center;">
            <div style="
              background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
              width: 80px;
              height: 80px;
              border-radius: 50%;
              margin: 0 auto 30px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 35px;
            ">🗑️</div>
            <h1 style="color: #212529; margin: 0 0 20px; font-size: 28px; font-weight: 700;">
              Poll Deleted
            </h1>
            <p style="color: #495057; font-size: 18px; line-height: 1.6; margin: 0 0 15px;">
              Hi <strong>${userName}</strong>,
            </p>
            <p style="color: #6c757d; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
              Your poll has been permanently deleted and cannot be recovered.
            </p>
            <div style="
              background: #f8d7da;
              border: 2px solid #f5c6cb;
              border-radius: 15px;
              padding: 25px;
              margin: 30px 0;
              text-align: left;
            ">
              <h3 style="color: #721c24; margin: 0 0 15px; font-size: 16px;">🗂️ Deleted Poll:</h3>
              <p style="
                color: #721c24;
                font-size: 18px;
                font-weight: 600;
                margin: 0 0 15px;
                font-style: italic;
                line-height: 1.4;
                text-decoration: line-through;
                opacity: 0.7;
              ">"${payload.question}"</p>
              <div>
                <span style="
                  background: #dc3545;
                  color: white;
                  padding: 6px 12px;
                  border-radius: 20px;
                  font-size: 12px;
                  font-weight: 600;
                ">🗑️ DELETED</span>
              </div>
              <p style="color: #721c24; font-size: 14px; margin: 15px 0 0; line-height: 1.4;">
                ⚠️ <strong>Note:</strong> This action is permanent and cannot be undone.
              </p>
            </div>
            <div style="margin: 30px 0;">
              <a href="${baseUrl}/create-poll" style="${buttonStyle('#28a745', '#218838')} margin-right: 15px;">
                ➕ Create New Poll
              </a>
              <a href="${baseUrl}/my-polls" style="${buttonStyle('#007bff', '#0056b3')}">
                📊 View My Polls
              </a>
            </div>
          </div>
        ${emailFooter}
      `
    }
  };
  
  return contentMap[event] || {
    subject: '🔔 Notification from Real-Time Polling',
    text: `Hi ${userName},\n\nYou have a new notification.\n\nBest regards,\nReal-Time Polling Team`,
    html: `
      ${emailWrapper}
        <div style="padding: 40px; text-align: center;">
          <div style="
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            width: 80px;
            height: 80px;
            border-radius: 50%;
            margin: 0 auto 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 35px;
          ">🔔</div>
          <h1 style="color: #212529; margin: 0 0 20px; font-size: 28px; font-weight: 700;">
            New Notification
          </h1>
          <p style="color: #495057; font-size: 18px; line-height: 1.6; margin: 0 0 15px;">
            Hi <strong>${userName}</strong>,
          </p>
          <p style="color: #6c757d; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
            You have received a new notification from Real-Time Polling.
          </p>
          <a href="${baseUrl}" style="${buttonStyle('#667eea', '#5a67d8')}">
            🏠 Go to Dashboard
          </a>
        </div>
      ${emailFooter}
    `
  };
}

// Main function to send notification emails
async function sendNotificationEmail(user, event, data = {}) {
  if (!user || !user.email) {
    console.log('[EMAIL] No user or email provided');
    return;
  }

  // Prepare payload with user data
  const payload = {
    ...data,
    name: user.name || 'User'
  };

  const { subject, text, html } = buildEmailContent(event, payload);

  // If SMTP not configured, log instead of sending
  if (!canSendEmail()) {
    console.log('[EMAIL MOCK]', {
      to: user.email,
      subject,
      event,
      data: payload
    });
    return;
  }

  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: user.email,
      subject,
      text,
      html
    };

    const info = await getTransporter().sendMail(mailOptions);
    console.log(`[EMAIL SENT] ${event} to ${user.email} - Message ID: ${info.messageId}`);
    
  } catch (error) {
    console.error(`[EMAIL ERROR] Failed to send ${event} to ${user.email}:`, error.message);
    // Don't throw - we want the main request to succeed even if email fails
  }
}

// Verify SMTP connection (optional, for testing)
async function testConnection() {
  if (!canSendEmail()) {
    console.log('[EMAIL TEST] SMTP not configured - would use mock mode');
    return { success: true, mode: 'mock' };
  }

  try {
    await getTransporter().verify();
    console.log('[EMAIL TEST] SMTP connection successful');
    return { success: true, mode: 'smtp' };
  } catch (error) {
    console.error('[EMAIL TEST] SMTP connection failed:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  canSendEmail,
  sendNotificationEmail,
  testConnection
};