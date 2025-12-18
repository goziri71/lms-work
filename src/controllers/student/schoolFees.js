import { Op } from "sequelize";
import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { Students } from "../../models/auth/student.js";
import { SchoolFees } from "../../models/payment/schoolFees.js";
import { SchoolFeesConfiguration } from "../../models/payment/schoolFeesConfiguration.js";
import { Funding } from "../../models/payment/funding.js";
import { PaymentTransaction } from "../../models/payment/paymentTransaction.js";
import { Semester } from "../../models/auth/semester.js";
import { getSchoolFeesForStudent } from "../admin/superAdmin/schoolFeesManagement.js";
import {
  verifyTransaction,
  isTransactionSuccessful,
  getTransactionAmount,
  getTransactionCurrency,
  getTransactionReference,
} from "../../services/flutterwaveService.js";
import { getWalletBalance } from "../../services/walletBalanceService.js";
import { calculateSchoolFeesForStudent } from "../../services/schoolFeesCalculationService.js";
import { db } from "../../database/database.js";

/**
 * Get student's school fees information for current academic year
 * GET /api/courses/school-fees
 */
export const getMySchoolFees = TryCatchFunction(async (req, res) => {
  const studentId = Number(req.user?.id);
  const userType = req.user?.userType;

  if (userType !== "student") {
    throw new ErrorClass("Only students can access this endpoint", 403);
  }

  // Get student
  const student = await Students.findByPk(studentId);
  if (!student) {
    throw new ErrorClass("Student not found", 404);
  }

  // Get current semester to determine academic year
  const currentDate = new Date();
  const today = currentDate.toISOString().split("T")[0];

  let currentSemester = await Semester.findOne({
    where: {
      [Op.and]: [
        Semester.sequelize.literal(`DATE(start_date) <= '${today}'`),
        Semester.sequelize.literal(`DATE(end_date) >= '${today}'`),
      ],
    },
    order: [["id", "DESC"]],
  });

  if (!currentSemester) {
    currentSemester = await Semester.findOne({
      where: Semester.sequelize.where(
        Semester.sequelize.fn("UPPER", Semester.sequelize.col("status")),
        "ACTIVE"
      ),
      order: [["id", "DESC"]],
    });
  }

  if (!currentSemester) {
    return res.status(200).json({
      success: true,
      message: "No active semester found",
      data: {
        academic_year: null,
        school_fees: null,
        payment_status: "unknown",
      },
    });
  }

  const academicYear = currentSemester.academic_year?.toString();
  const semester = currentSemester.semester?.toString();

  // Calculate school fees using Payment Setup (standard) + Configuration (override)
  const feesCalculation = await calculateSchoolFeesForStudent(
    student,
    academicYear,
    semester,
    student.currency
  );

  // Check if student has already paid for this semester
  const existingPayment = await SchoolFees.findOne({
    where: {
      student_id: studentId,
      academic_year: academicYear,
      semester: semester,
      status: "Paid",
    },
    order: [["id", "DESC"]],
  });

  const amount = feesCalculation.amount;
  const currency = feesCalculation.currency;

  // Get wallet balance (with automatic migration of old balances)
  const { balance: walletBalance } = await getWalletBalance(studentId, true);
  const canPayFromWallet = walletBalance >= amount;

  res.status(200).json({
    success: true,
    message: "School fees information retrieved successfully",
    data: {
      academic_year: academicYear,
      semester: semester,
      school_fees: {
        amount: amount,
        currency: currency,
        source: feesCalculation.source, // 'payment_setup' or 'configuration'
        items: feesCalculation.items, // Itemized breakdown from Payment Setup
        payment_setup_total: feesCalculation.payment_setup_total, // Total from Payment Setup
        configuration: feesCalculation.configuration, // Configuration details if override was used
      },
      payment_status: existingPayment ? "paid" : "pending",
      payment: existingPayment
        ? {
            id: existingPayment.id,
            amount: existingPayment.amount,
            status: existingPayment.status,
            date: existingPayment.date,
            teller_no: existingPayment.teller_no,
            semester: existingPayment.semester,
          }
        : null,
      wallet: {
        balance: walletBalance,
        currency: currency,
        can_pay_from_wallet: canPayFromWallet,
      },
    },
  });
});

/**
 * Get student's school fees payment history
 * GET /api/courses/school-fees/history
 */
export const getMySchoolFeesHistory = TryCatchFunction(async (req, res) => {
  const studentId = Number(req.user?.id);
  const userType = req.user?.userType;

  if (userType !== "student") {
    throw new ErrorClass("Only students can access this endpoint", 403);
  }

  // Get query parameters for filtering
  const { page = 1, limit = 20, status, semester, academic_year } = req.query;

  // Build where clause
  const where = {
    student_id: studentId,
  };

  if (status) {
    where.status = status; // Filter by status (Paid, Pending, etc.)
  }

  if (semester) {
    where.semester = semester.toString().toUpperCase();
  }

  if (academic_year) {
    where.academic_year = academic_year.toString();
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);

  // Get school fees history with pagination
  const { count, rows: schoolFeesHistory } = await SchoolFees.findAndCountAll({
    where,
    limit: parseInt(limit),
    offset,
    order: [["date", "DESC"], ["id", "DESC"]], // Most recent first
  });

  res.status(200).json({
    success: true,
    message: "School fees payment history retrieved successfully",
    data: {
      history: schoolFeesHistory.map((fee) => ({
        id: fee.id,
        amount: fee.amount,
        currency: fee.currency || "NGN",
        status: fee.status,
        academic_year: fee.academic_year,
        semester: fee.semester,
        date: fee.date,
        teller_no: fee.teller_no,
        type: fee.type,
        student_level: fee.student_level,
      })),
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit)),
      },
    },
  });
});

/**
 * Verify Flutterwave payment and fund wallet only
 * NOTE: This endpoint is kept for backward compatibility but now only funds wallet
 * For paying school fees, use paySchoolFeesFromWallet after funding
 * POST /api/courses/school-fees/verify
 * @deprecated Use /api/wallet/fund instead for wallet funding
 */
export const verifySchoolFeesPayment = TryCatchFunction(async (req, res) => {
  const studentId = Number(req.user?.id);
  const userType = req.user?.userType;

  if (userType !== "student") {
    throw new ErrorClass("Only students can verify payments", 403);
  }

  // Frontend sends transaction reference from Flutterwave callback
  const { transaction_reference, flutterwave_transaction_id } = req.body || {};

  if (!transaction_reference && !flutterwave_transaction_id) {
    throw new ErrorClass(
      "transaction_reference or flutterwave_transaction_id is required",
      400
    );
  }

  // Get student
  const student = await Students.findByPk(studentId);
  if (!student) {
    throw new ErrorClass("Student not found", 404);
  }

  // Get current semester for academic year
  const currentDate = new Date();
  const today = currentDate.toISOString().split("T")[0];

  let currentSemester = await Semester.findOne({
    where: {
      [Op.and]: [
        Semester.sequelize.literal(`DATE(start_date) <= '${today}'`),
        Semester.sequelize.literal(`DATE(end_date) >= '${today}'`),
      ],
    },
    order: [["id", "DESC"]],
  });

  if (!currentSemester) {
    currentSemester = await Semester.findOne({
      where: Semester.sequelize.where(
        Semester.sequelize.fn("UPPER", Semester.sequelize.col("status")),
        "ACTIVE"
      ),
      order: [["id", "DESC"]],
    });
  }

  const academicYear = currentSemester?.academic_year?.toString() || null;

  // Verify transaction with Flutterwave API
  const verificationId = flutterwave_transaction_id || transaction_reference;
  let verificationResult;

  try {
    verificationResult = await verifyTransaction(verificationId);
  } catch (error) {
    throw new ErrorClass(
      `Payment verification failed: ${error.message}`,
      400
    );
  }

  if (!verificationResult.success || !isTransactionSuccessful(verificationResult.transaction)) {
    throw new ErrorClass("Payment was not successful", 400);
  }

  const flutterwaveTransaction = verificationResult.transaction;

  // Get transaction amount and currency
  const transactionAmount = getTransactionAmount(flutterwaveTransaction);
  const transactionCurrency = getTransactionCurrency(flutterwaveTransaction);

  // Check if transaction reference already processed (idempotency)
  const txRef = getTransactionReference(flutterwaveTransaction);
  const existingTransaction = await PaymentTransaction.findOne({
    where: {
      [Op.or]: [
        { transaction_reference: txRef },
        { flutterwave_transaction_id: flutterwaveTransaction.id?.toString() },
      ],
      status: "successful",
    },
  });

  if (existingTransaction) {
    // Return existing transaction info
    const totalCredits = await Funding.sum("amount", {
      where: { student_id: studentId, type: "Credit" },
    });
    const totalDebits = await Funding.sum("amount", {
      where: { student_id: studentId, type: "Debit" },
    });
    const currentBalance = (totalCredits || 0) - (totalDebits || 0);

    return res.status(200).json({
      success: true,
      message: "Wallet funding already processed",
      data: {
        transaction: {
          transaction_reference: txRef,
          status: "successful",
          amount: transactionAmount,
        },
        wallet: {
          balance: currentBalance,
          currency: transactionCurrency,
        },
      },
    });
  }

  // Create payment transaction record
  const paymentTransaction = await PaymentTransaction.create({
    student_id: studentId,
    transaction_reference: txRef,
    flutterwave_transaction_id: flutterwaveTransaction.id?.toString(),
    amount: transactionAmount,
    currency: transactionCurrency,
    status: "successful",
    payment_type: "wallet_funding",
    academic_year: academicYear,
    processed_at: new Date(),
    flutterwave_response: flutterwaveTransaction,
  });

  // Get current wallet balance
  const totalCredits = await Funding.sum("amount", {
    where: { student_id: studentId, type: "Credit" },
  });
  const totalDebits = await Funding.sum("amount", {
    where: { student_id: studentId, type: "Debit" },
  });
  const currentBalance = (totalCredits || 0) - (totalDebits || 0);

  // Credit wallet
  const newBalance = currentBalance + transactionAmount;

  const funding = await Funding.create({
    student_id: studentId,
    amount: transactionAmount,
    type: "Credit",
    service_name: "Wallet Funding",
    ref: txRef,
    date: today,
    semester: currentSemester?.semester || null,
    academic_year: academicYear,
    currency: transactionCurrency,
    balance: newBalance.toString(),
  });

  // Update student wallet_balance
  await student.update({
    wallet_balance: newBalance,
  });

  res.status(200).json({
    success: true,
    message: "Wallet funded successfully",
    data: {
      transaction: {
        transaction_reference: txRef,
        amount: transactionAmount,
        currency: transactionCurrency,
      },
      wallet: {
        previous_balance: currentBalance,
        new_balance: newBalance,
        credited: transactionAmount,
        currency: transactionCurrency,
      },
    },
  });
});

/**
 * Pay school fees from wallet
 * Deducts amount from wallet and marks school fees as paid
 * POST /api/courses/school-fees/pay-from-wallet
 */
export const paySchoolFeesFromWallet = TryCatchFunction(async (req, res) => {
  const studentId = Number(req.user?.id);
  const userType = req.user?.userType;

  if (userType !== "student") {
    throw new ErrorClass("Only students can pay school fees", 403);
  }

  // Get student
  const student = await Students.findByPk(studentId);
  if (!student) {
    throw new ErrorClass("Student not found", 404);
  }

  // Get current semester to determine academic year
  const currentDate = new Date();
  const today = currentDate.toISOString().split("T")[0];

  let currentSemester = await Semester.findOne({
    where: {
      [Op.and]: [
        Semester.sequelize.literal(`DATE(start_date) <= '${today}'`),
        Semester.sequelize.literal(`DATE(end_date) >= '${today}'`),
      ],
    },
    order: [["id", "DESC"]],
  });

  if (!currentSemester) {
    currentSemester = await Semester.findOne({
      where: Semester.sequelize.where(
        Semester.sequelize.fn("UPPER", Semester.sequelize.col("status")),
        "ACTIVE"
      ),
      order: [["id", "DESC"]],
    });
  }

  if (!currentSemester) {
    throw new ErrorClass("No active semester found", 404);
  }

  const academicYear = currentSemester.academic_year?.toString();
  const semester = currentSemester.semester?.toString();

  // Check if already paid for this semester
  const existingPayment = await SchoolFees.findOne({
    where: {
      student_id: studentId,
      academic_year: academicYear,
      semester: semester,
      status: "Paid",
    },
  });

  if (existingPayment) {
    throw new ErrorClass(
      `School fees for ${academicYear} ${semester} have already been paid`,
      400
    );
  }

  // Calculate school fees using Payment Setup (standard) + Configuration (override)
  const feesCalculation = await calculateSchoolFeesForStudent(
    student,
    academicYear,
    semester,
    student.currency
  );

  // If no Payment Setup items exist and no Configuration, throw error
  if (feesCalculation.amount === 0 && feesCalculation.items.length === 0) {
    throw new ErrorClass(
      "School fees not configured for this semester. Please contact admin.",
      404
    );
  }

  const amount = feesCalculation.amount;
  // Ensure currency is always set and valid (required field, no null allowed)
  // School fees payment is 100% wallet-based, no Flutterwave integration
  const currency = (feesCalculation.currency || student.currency || "NGN").toString().toUpperCase().substring(0, 5);

  // Get current wallet balance (with automatic migration of old balances)
  const { balance: currentBalance } = await getWalletBalance(studentId, true);

  // Check if wallet has sufficient balance
  if (currentBalance < amount) {
    throw new ErrorClass(
      `Insufficient wallet balance. Required: ${amount} ${currency}, Available: ${currentBalance} ${currency}`,
      400
    );
  }

  // Generate transaction reference
  const txRef = `WALLET-SCHOOL-FEES-${Date.now()}`;

  // Use database transaction to ensure atomicity
  // If any step fails, everything will be rolled back
  const transaction = await db.transaction();

  try {
    // Debit wallet
    const newBalance = currentBalance - amount;

    // Create Funding record (Debit)
    const funding = await Funding.create(
      {
        student_id: studentId,
        amount: amount,
        type: "Debit",
        service_name: "School Fees Payment",
        ref: txRef,
        date: today,
        semester: currentSemester.semester || null,
        academic_year: academicYear,
        currency: currency,
        balance: newBalance.toString(),
      },
      { transaction }
    );

    // Update student wallet_balance
    await student.update(
      {
        wallet_balance: newBalance,
      },
      { transaction }
    );

    // Create SchoolFees record (per semester)
    // Ensure field lengths match model constraints and currency is always set
    const schoolFeeData = {
      student_id: studentId,
      amount: Math.round(amount), // Ensure integer
      status: "Paid",
      academic_year: academicYear ? academicYear.toString().substring(0, 20) : null,
      semester: semester ? semester.toString().substring(0, 20) : null,
      date: today ? today.substring(0, 20) : null,
      teller_no: txRef, // Already VARCHAR(255) after migration
      matric_number: student.matric_number ? student.matric_number.toString().substring(0, 40) : null,
      type: "School Fees", // VARCHAR(50) - "School Fees" is 12 chars, safe
      student_level: student.level ? student.level.toString().substring(0, 11) : null, // VARCHAR(11)
      currency: currency, // Already validated above, VARCHAR(5), always set
    };

    // Log the data being created for debugging
    console.log("Creating SchoolFees record with data:", JSON.stringify(schoolFeeData, null, 2));

    let schoolFee;
    try {
      schoolFee = await SchoolFees.create(schoolFeeData, { transaction });
    } catch (createError) {
      // Log detailed error before re-throwing
      console.error("❌ SchoolFees.create failed with detailed error:", {
        name: createError.name,
        message: createError.message,
        errors: createError.errors ? JSON.stringify(createError.errors, null, 2) : null,
        original: createError.original ? {
          message: createError.original.message,
          code: createError.original.code,
          detail: createError.original.detail,
          constraint: createError.original.constraint,
          table: createError.original.table,
        } : null,
        schoolFeeData: JSON.stringify(schoolFeeData, null, 2),
      });
      throw createError; // Re-throw to be caught by outer catch block
    }

    // If we get here, all operations succeeded - commit the transaction
    await transaction.commit();

    res.status(200).json({
      success: true,
      message: "School fees paid successfully from wallet",
      data: {
        payment: {
          id: schoolFee.id,
          amount: amount,
          currency: currency,
          academic_year: academicYear,
          semester: semester,
          payment_reference: txRef,
          date: today,
        },
        wallet: {
          previous_balance: currentBalance,
          new_balance: newBalance,
          debited: amount,
          currency: currency,
        },
      },
    });
  } catch (error) {
    // If any error occurs, rollback the entire transaction
    await transaction.rollback();
    
    // Enhanced error logging for validation errors
    console.error("❌ Error processing school fees payment, transaction rolled back:", {
      message: error.message,
      name: error.name,
      errors: error.errors ? JSON.stringify(error.errors, null, 2) : null,
      original: error.original ? {
        message: error.original.message,
        code: error.original.code,
        detail: error.original.detail,
        constraint: error.original.constraint,
      } : null,
      studentId,
      amount,
      currency,
      academicYear,
      semester,
      txRef,
    });
    
    // If it's a Sequelize validation error, provide more details
    if (error.name === "SequelizeValidationError") {
      if (error.errors && error.errors.length > 0) {
        const validationErrors = error.errors.map(e => `${e.path || e.column || 'unknown'}: ${e.message}`).join(", ");
        throw new ErrorClass(`Validation error: ${validationErrors}`, 400);
      }
    }
    
    // Database constraint errors (e.g., unique constraint, foreign key, check constraint)
    if (error.name === "SequelizeDatabaseError" || error.original) {
      const dbError = error.original || error;
      const errorMessage = dbError.message || error.message;
      const errorDetail = dbError.detail || "";
      const errorConstraint = dbError.constraint || "";
      
      // Handle primary key sequence issues
      if (errorConstraint === "school_fees_pkey" && errorMessage.includes("duplicate key")) {
        throw new ErrorClass(
          "Database sequence error. Please contact admin to fix the sequence. Error: " + errorDetail,
          500
        );
      }
      
      // Provide detailed error message
      let detailedMessage = `Database error: ${errorMessage}`;
      if (errorDetail) {
        detailedMessage += ` | Detail: ${errorDetail}`;
      }
      if (errorConstraint) {
        detailedMessage += ` | Constraint: ${errorConstraint}`;
      }
      
      throw new ErrorClass(detailedMessage, 400);
    }
    
    // Re-throw the error so it's handled by TryCatchFunction
    throw error;
  }
});
