/**
 * Community Subscription Purchase Controller
 * Handles student purchases of community subscriptions
 */

import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { Community } from "../../models/marketplace/community.js";
import { CommunitySubscription } from "../../models/marketplace/communitySubscription.js";
import { CommunityMember } from "../../models/marketplace/communityMember.js";
import { CommunityPurchase } from "../../models/marketplace/communityPurchase.js";
import { Students } from "../../models/auth/student.js";
import { Funding } from "../../models/payment/funding.js";
import { GeneralSetup } from "../../models/settings/generalSetup.js";
import { getWalletBalance } from "../../services/walletBalanceService.js";
import { SoleTutor } from "../../models/marketplace/soleTutor.js";
import { Organization } from "../../models/marketplace/organization.js";
import { WspCommission } from "../../models/marketplace/wspCommission.js";
import { db } from "../../database/database.js";
import { emailService } from "../../services/emailService.js";
import { Config } from "../../config/config.js";

/**
 * Purchase community subscription
 * POST /api/marketplace/communities/:id/subscribe
 */
export const purchaseCommunitySubscription = TryCatchFunction(async (req, res) => {
  const { id } = req.params;
  const studentId = req.user?.id;

  if (req.user?.userType !== "student") {
    throw new ErrorClass("Only students can subscribe to communities", 403);
  }

  // Get community
  const community = await Community.findByPk(id);
  if (!community) {
    throw new ErrorClass("Community not found", 404);
  }

  if (community.status !== "published") {
    throw new ErrorClass("This community is not available for subscription", 400);
  }

  // Check if already subscribed
  const existingSubscription = await CommunitySubscription.findOne({
    where: {
      community_id: id,
      student_id: studentId,
      status: "active",
    },
  });

  if (existingSubscription) {
    throw new ErrorClass("You are already subscribed to this community", 400);
  }

  // Verify student exists
  const student = await Students.findByPk(studentId);
  if (!student) {
    throw new ErrorClass("Student not found", 404);
  }

  // Get exchange rate
  const generalSetup = await GeneralSetup.findOne({
    order: [["id", "DESC"]],
  });
  const exchangeRate = parseFloat(generalSetup?.rate || "1500");

  // Get currencies
  const communityCurrency = (community.currency || "NGN").toUpperCase();
  const studentCurrency = (student.currency || "NGN").toUpperCase();
  const communityPrice = parseFloat(community.price);

  // Convert price to student's currency if needed
  let priceInStudentCurrency = communityPrice;
  if (communityCurrency !== studentCurrency) {
    if (communityCurrency === "USD" && studentCurrency === "NGN") {
      priceInStudentCurrency = communityPrice * exchangeRate;
    } else if (communityCurrency === "NGN" && studentCurrency === "USD") {
      priceInStudentCurrency = communityPrice / exchangeRate;
    }
    priceInStudentCurrency = Math.round(priceInStudentCurrency * 100) / 100;
  }

  // Check wallet balance
  const { balance: walletBalance } = await getWalletBalance(studentId, true);

  if (walletBalance < priceInStudentCurrency) {
    let requiredDisplay;
    if (communityCurrency !== studentCurrency) {
      requiredDisplay = `${priceInStudentCurrency.toFixed(2)} ${studentCurrency} (${communityPrice} ${communityCurrency})`;
    } else {
      requiredDisplay = `${priceInStudentCurrency.toFixed(2)} ${studentCurrency}`;
    }

    throw new ErrorClass(
      `Insufficient wallet balance. Required: ${requiredDisplay}, Available: ${walletBalance.toFixed(2)} ${studentCurrency}. Please fund your wallet first.`,
      400
    );
  }

  // No commission for communities
  const commissionRate = 0;
  const wspCommission = 0;
  const tutorEarnings = priceInStudentCurrency;

  // Generate transaction reference
  const txRef = `COMMUNITY-SUB-${id}-${Date.now()}`;
  const today = new Date().toISOString().split("T")[0];

  // Calculate dates
  const now = new Date();
  const nextBillingDate = new Date(now);
  nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

  // Use transaction
  const transaction = await db.transaction();

  try {
    // Debit wallet
    const newBalance = walletBalance - priceInStudentCurrency;

    await Funding.create(
      {
        student_id: studentId,
        amount: priceInStudentCurrency,
        type: "Debit",
        service_name: "Community Subscription",
        ref: txRef,
        date: today,
        semester: null,
        academic_year: null,
        currency: studentCurrency,
        balance: newBalance.toString(),
      },
      { transaction }
    );

    // Update student wallet
    await student.update(
      { wallet_balance: newBalance },
      { transaction }
    );

    // Create subscription
    const subscription = await CommunitySubscription.create(
      {
        community_id: id,
        student_id: studentId,
        price: communityPrice,
        currency: communityCurrency,
        status: "active",
        start_date: now,
        next_billing_date: nextBillingDate,
        auto_renew: true,
        payment_reference: txRef,
      },
      { transaction }
    );

    // Create or update community member
    const [member, memberCreated] = await CommunityMember.findOrCreate({
      where: {
        community_id: id,
        student_id: studentId,
      },
      defaults: {
        role: "member",
        status: "active",
        subscription_status: "active",
        subscription_start_date: now,
        subscription_end_date: nextBillingDate,
        next_billing_date: nextBillingDate,
        joined_at: now,
      },
      transaction,
    });

    if (!memberCreated) {
      // Update existing member
      await member.update(
        {
          status: "active",
          subscription_status: "active",
          subscription_start_date: now,
          subscription_end_date: nextBillingDate,
          next_billing_date: nextBillingDate,
          access_blocked_at: null,
        },
        { transaction }
      );
    }

    // Update community member count
    await community.increment("member_count", { transaction });

    // Create purchase record
    await CommunityPurchase.create(
      {
        community_id: id,
        student_id: studentId,
        amount: priceInStudentCurrency,
        currency: studentCurrency,
        commission_rate: commissionRate,
        wsp_commission: wspCommission,
        tutor_earnings: tutorEarnings,
        payment_reference: txRef,
        payment_method: "wallet",
      },
      { transaction }
    );

    // Distribute revenue
    const tutorId = community.tutor_id;
    const tutorType = community.tutor_type;

    let tutor;
    if (tutorType === "sole_tutor") {
      tutor = await SoleTutor.findByPk(tutorId, { transaction });
      if (tutor) {
        await tutor.increment("wallet_balance", {
          by: tutorEarnings,
          transaction,
        });
      }
    } else {
      tutor = await Organization.findByPk(tutorId, { transaction });
      if (tutor) {
        await tutor.increment("wallet_balance", {
          by: tutorEarnings,
          transaction,
        });
      }
    }

    // Record WSP commission
    await WspCommission.create(
      {
        transaction_type: "community_subscription",
        transaction_id: subscription.id,
        tutor_id: tutorId,
        tutor_type: tutorType,
        amount: priceInStudentCurrency,
        currency: studentCurrency,
        commission_rate: commissionRate,
        commission_amount: wspCommission,
        status: "completed",
      },
      { transaction }
    );

    await transaction.commit();

    // Send confirmation email
    const studentName = `${student.fname || ""} ${student.mname || ""} ${student.lname || ""}`.trim() || student.email;
    await emailService.sendEmail({
      to: student.email,
      name: studentName,
      subject: `Welcome to ${community.name}!`,
      htmlBody: `
        <h2>Welcome to ${community.name}!</h2>
        <p>Your subscription has been activated successfully.</p>
        <p><strong>Community:</strong> ${community.name}</p>
        <p><strong>Price:</strong> ${priceInStudentCurrency.toFixed(2)} ${studentCurrency}</p>
        <p><strong>Next Billing Date:</strong> ${nextBillingDate.toLocaleDateString()}</p>
        <p><strong>Auto-renew:</strong> Enabled</p>
        <p><a href="${Config.frontendUrl}/communities/${id}">Visit Community</a></p>
      `,
    });

    res.status(201).json({
      status: true,
      code: 201,
      message: "Community subscription purchased successfully",
      data: {
        subscription,
        member,
        next_billing_date: nextBillingDate,
      },
    });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
});

