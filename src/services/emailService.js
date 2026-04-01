import { SendMailClient } from "zeptomail";
import { Config } from "../config/config.js";
import { renderTemplate } from "../utils/templateRenderer.js";

class EmailService {
  constructor() {
    // Validate email configuration
    const hasEmailConfig = Config.email.apiUrl && Config.email.apiToken && Config.email.fromAddress;
    
    if (!hasEmailConfig) {
      console.warn("⚠️ Email configuration incomplete. Missing required environment variables:");
      if (!Config.email.apiUrl) console.warn("  - ZEPTOMAIL_API_URL");
      if (!Config.email.apiToken) console.warn("  - ZEPTOMAIL_TOKEN");
      if (!Config.email.fromAddress) console.warn("  - EMAIL_FROM_ADDRESS");
      this.client = null;
    } else {
      try {
        this.client = new SendMailClient({
          url: Config.email.apiUrl,
          token: Config.email.apiToken,
        });
      } catch (error) {
        console.error("❌ Failed to initialize ZeptoMail client:", error.message);
        this.client = null;
      }
    }
    
    this.fromAddress = Config.email.fromAddress;
    this.fromName = Config.email.fromName;
    this.enabled = Config.email.enabled && hasEmailConfig;
  }

  /**
   * Core method to send email via ZeptoMail
   * @param {Object} options - Email options
   * @param {string} options.to - Recipient email address
   * @param {string} options.name - Recipient name
   * @param {string} options.subject - Email subject
   * @param {string} options.htmlBody - HTML body content
   * @returns {Promise<Object>} - Result of email send
   */
  async sendEmail({ to, name, subject, htmlBody }) {
    try {
      // Check if email client is initialized
      if (!this.client) {
        const errorMsg = "Email service not configured. Missing ZeptoMail credentials.";
        console.error(`❌ ${errorMsg}`);
        return {
          success: false,
          message: errorMsg,
        };
      }

      // Check if email is enabled (useful for testing/development)
      if (!this.enabled) {
        console.log(`📧 Email sending disabled. Would send to: ${to}`);
        console.log(`Subject: ${subject}`);
        return { success: true, message: "Email disabled in config" };
      }

      // Validate email address
      if (!this.validateEmail(to)) {
        throw new Error(`Invalid email address: ${to}`);
      }

      // Validate required fields
      if (!this.fromAddress) {
        throw new Error("From address not configured");
      }

      const mailOptions = {
        from: {
          address: this.fromAddress,
          name: this.fromName,
        },
        to: [
          {
            email_address: {
              address: to,
              name: name || to,
            },
          },
        ],
        subject: subject,
        htmlbody: htmlBody,
      };

      const response = await this.client.sendMail(mailOptions);

      console.log(`✅ Email sent successfully to ${to} - Subject: ${subject}`);

      return {
        success: true,
        message: "Email sent successfully",
        response,
      };
    } catch (error) {
      const errorMessage = error.message || "Unknown error occurred";
      console.error(`❌ Failed to send email to ${to}:`, errorMessage);
      if (error.response) {
        console.error("ZeptoMail API Error:", JSON.stringify(error.response.data || error.response, null, 2));
      }
      return {
        success: false,
        message: errorMessage,
        error: error.response?.data || error.message,
      };
    }
  }

  /**
   * Tutor → learner message via ZeptoMail (To + optional CC/BCC + Reply-To).
   * Body is plain text; HTML is escaped for safety.
   */
  async sendTutorLearnerMessage({
    to,
    toName,
    subject,
    messageText,
    tutorName,
    cc = [],
    bcc = [],
    replyTo = null,
  }) {
    try {
      if (!this.client) {
        const errorMsg = "Email service not configured. Missing ZeptoMail credentials.";
        console.error(`❌ ${errorMsg}`);
        return { success: false, message: errorMsg };
      }
      if (!this.enabled) {
        console.log(`📧 Email disabled. Tutor message would send to: ${to}`);
        return { success: true, message: "Email disabled in config" };
      }
      if (!this.validateEmail(to)) {
        throw new Error(`Invalid primary recipient: ${to}`);
      }
      if (!this.fromAddress) {
        throw new Error("From address not configured");
      }

      const escapeHtml = (s) =>
        String(s)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");

      const safeTutor = escapeHtml(tutorName || "Your instructor");
      const safeBody = escapeHtml(messageText || "");
      const htmlBody = `<!DOCTYPE html>
<html><body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#1a1a1a">
<p>Message from <strong>${safeTutor}</strong> (your instructor on Knomada):</p>
<div style="white-space:pre-wrap;border-left:3px solid #e5e7eb;padding:12px 16px;margin:16px 0;background:#fafafa">${safeBody}</div>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
<p style="font-size:12px;color:#6b7280">This email was sent through Knomada. Replies go to your instructor if your mail client supports it.</p>
</body></html>`;

      const textbody = `Message from ${tutorName || "Your instructor"}:\n\n${messageText || ""}\n\n---\nSent via Knomada`;

      const toPayload = [
        {
          email_address: {
            address: to,
            name: (toName && String(toName).trim()) || to,
          },
        },
      ];

      const mapAddr = (list) =>
        list.map((raw) => {
          const address = String(raw).trim();
          return {
            email_address: {
              address,
              name: address,
            },
          };
        });

      const mailOptions = {
        from: {
          address: this.fromAddress,
          name: this.fromName,
        },
        to: toPayload,
        subject: String(subject).trim(),
        htmlbody: htmlBody,
        textbody,
      };

      if (cc.length > 0) {
        mailOptions.cc = mapAddr(cc);
      }
      if (bcc.length > 0) {
        mailOptions.bcc = mapAddr(bcc);
      }
      if (replyTo && replyTo.address && this.validateEmail(replyTo.address)) {
        mailOptions.reply_to = [
          {
            address: replyTo.address,
            name: (replyTo.name && String(replyTo.name).trim()) || replyTo.address,
          },
        ];
      }

      const response = await this.client.sendMail(mailOptions);
      console.log(`✅ Tutor learner email sent to ${to} — ${subject}`);

      return {
        success: true,
        message: "Email sent successfully",
        response,
      };
    } catch (error) {
      const errorMessage = error.message || "Unknown error occurred";
      console.error(`❌ Tutor learner email failed for ${to}:`, errorMessage);
      if (error.response) {
        console.error("ZeptoMail API Error:", JSON.stringify(error.response.data || error.response, null, 2));
      }
      return {
        success: false,
        message: errorMessage,
        error: error.response?.data || error.message,
      };
    }
  }

  /**
   * Send welcome email to new users
   * @param {Object} user - User object
   * @param {string} user.email - User email
   * @param {string} user.name - User name
   * @param {string} userType - Type of user (student/staff)
   */
  async sendWelcomeEmail(user, userType = "student") {
    try {
      const htmlBody = await renderTemplate("welcome", {
        userName: user.name || user.email,
        userEmail: user.email,
        userType: userType,
        loginUrl: `${
          Config.frontendUrl || "https://app.knomada.co"
        }/login`,
        currentYear: new Date().getFullYear(),
      });

      return await this.sendEmail({
        to: user.email,
        name: user.name,
        subject: "Welcome to Knomada",
        htmlBody,
      });
    } catch (error) {
      console.error("Error sending welcome email:", error);
      throw error;
    }
  }

  /**
   * Send password reset email
   * @param {Object} user - User object
   * @param {string} resetToken - Password reset token
   * @param {string} resetUrl - Full reset URL
   */
  async sendPasswordResetEmail(user, resetToken, resetUrl) {
    try {
      const htmlBody = await renderTemplate("password-reset", {
        userName: user.name || user.email,
        resetUrl: resetUrl,
        resetToken: resetToken,
        expiryTime: "1 hour",
        currentYear: new Date().getFullYear(),
      });

      return await this.sendEmail({
        to: user.email,
        name: user.name,
        subject: "Password Reset Request - Knomada",
        htmlBody,
      });
    } catch (error) {
      console.error("Error sending password reset email:", error);
      throw error;
    }
  }

  /**
   * Send course enrollment confirmation
   * @param {Object} student - Student object
   * @param {Object} course - Course object
   */
  async sendCourseEnrollmentEmail(student, course) {
    try {
      const htmlBody = await renderTemplate("course-enrollment", {
        studentName: student.name || student.email,
        courseName: course.title || course.name,
        courseCode: course.code,
        instructor: course.instructor || "TBA",
        startDate: course.start_date || "To be announced",
        courseUrl: `${
          Config.frontendUrl || "https://app.knomada.co"
        }/courses/${course.id}`,
        currentYear: new Date().getFullYear(),
      });

      return await this.sendEmail({
        to: student.email,
        name: student.name,
        subject: `Course Enrollment Confirmed: ${course.title || course.name}`,
        htmlBody,
      });
    } catch (error) {
      console.error("Error sending course enrollment email:", error);
      throw error;
    }
  }

  /**
   * Send exam reminder email
   * @param {Object} student - Student object
   * @param {Object} exam - Exam object
   */
  async sendExamReminderEmail(student, exam) {
    try {
      const htmlBody = await renderTemplate("exam-reminder", {
        studentName: student.name || student.email,
        examTitle: exam.title,
        examDate: exam.exam_date,
        examTime: exam.start_time,
        duration: exam.duration_minutes,
        courseName: exam.course?.title || "Your Course",
        examUrl: `${
          Config.frontendUrl || "https://app.knomada.co"
        }/exams/${exam.id}`,
        currentYear: new Date().getFullYear(),
      });

      return await this.sendEmail({
        to: student.email,
        name: student.name,
        subject: `Exam Reminder: ${exam.title}`,
        htmlBody,
      });
    } catch (error) {
      console.error("Error sending exam reminder email:", error);
      throw error;
    }
  }

  /**
   * Send grade notification email
   * @param {Object} student - Student object
   * @param {Object} gradeInfo - Grade information
   */
  async sendGradeNotificationEmail(student, gradeInfo) {
    try {
      const htmlBody = await renderTemplate("grade-notification", {
        studentName: student.name || student.email,
        courseName: gradeInfo.courseName,
        assessmentType: gradeInfo.assessmentType, // 'Exam', 'Quiz', 'Assignment'
        assessmentTitle: gradeInfo.assessmentTitle,
        score: gradeInfo.score,
        totalScore: gradeInfo.totalScore,
        grade: gradeInfo.grade,
        viewUrl: `${
          Config.frontendUrl || "https://app.knomada.co"
        }/grades`,
        currentYear: new Date().getFullYear(),
      });

      return await this.sendEmail({
        to: student.email,
        name: student.name,
        subject: `New Grade Posted: ${gradeInfo.assessmentTitle}`,
        htmlBody,
      });
    } catch (error) {
      console.error("Error sending grade notification email:", error);
      throw error;
    }
  }

  /**
   * Send admin welcome email
   * @param {Object} admin - Admin information
   * @param {string} temporaryPassword - Temporary password
   */
  async sendAdminWelcomeEmail(admin, temporaryPassword) {
    try {
      const htmlBody = await renderTemplate("admin-welcome", {
        fname: admin.fname,
        lname: admin.lname,
        email: admin.email,
        temporaryPassword,
        roleDisplay: admin.role === "super_admin" ? "Super Admin" : "WSP Admin",
        isSuperAdmin: admin.role === "super_admin",
        loginUrl: `${
          Config.frontendUrl || "https://app.knomada.co"
        }/admin/login`,
        currentYear: new Date().getFullYear(),
      });

      return await this.sendEmail({
        to: admin.email,
        name: `${admin.fname} ${admin.lname}`,
        subject: "Welcome to WSP Admin System - Your Account is Ready!",
        htmlBody,
      });
    } catch (error) {
      console.error("Error sending admin welcome email:", error);
      throw error;
    }
  }

  /**
   * Send password changed notification
   * @param {Object} user - User information
   * @param {Object} changeInfo - Change details
   */
  async sendPasswordChangedEmail(user, changeInfo = {}) {
    try {
      const userType = changeInfo.userType || "student"; // student, staff, admin
      let loginUrl = `${Config.frontendUrl || "https://app.knomada.co"}/login`;
      
      if (userType === "admin") {
        loginUrl = `${Config.frontendUrl || "https://app.knomada.co"}/admin/login`;
      }

      const htmlBody = await renderTemplate("password-changed", {
        fname: user.fname,
        lname: user.lname,
        changedAt: new Date().toLocaleString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        ipAddress: changeInfo.ipAddress || "Unknown",
        device: changeInfo.device || "Unknown",
        changedBy: changeInfo.changedBy || null,
        isAdminReset: !!changeInfo.changedBy,
        loginUrl,
        currentYear: new Date().getFullYear(),
      });

      return await this.sendEmail({
        to: user.email,
        name: `${user.fname} ${user.lname}`,
        subject: "Your Password Has Been Changed",
        htmlBody,
      });
    } catch (error) {
      console.error("Error sending password changed email:", error);
      throw error;
    }
  }

  /**
   * Validate email address format
   * @param {string} email - Email address to validate
   * @returns {boolean} - True if valid
   */
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

// Export singleton instance
export const emailService = new EmailService();
export default emailService;
