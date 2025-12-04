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

  // Get school fees configuration for this student
  const feesConfig = await getSchoolFeesForStudent(student, academicYear);

  if (!feesConfig) {
    return res.status(200).json({
      success: true,
      message: "No school fees configuration found for current academic year",
      data: {
        academic_year: academicYear,
        school_fees: null,
        payment_status: "not_configured",
      },
    });
  }

  // Check if student has already paid for this academic year
  const existingPayment = await SchoolFees.findOne({
    where: {
      student_id: studentId,
      academic_year: academicYear,
      status: "Paid",
    },
    order: [["id", "DESC"]],
  });

  const amount = parseFloat(feesConfig.amount);
  const currency = feesConfig.currency;

  res.status(200).json({
    success: true,
    message: "School fees information retrieved successfully",
    data: {
      academic_year: academicYear,
      school_fees: {
        amount: amount,
        currency: currency,
        level: feesConfig.level,
        description: feesConfig.description,
      },
      payment_status: existingPayment ? "paid" : "pending",
      payment: existingPayment
        ? {
            id: existingPayment.id,
            amount: existingPayment.amount,
            status: existingPayment.status,
            date: existingPayment.date,
            teller_no: existingPayment.teller_no,
          }
        : null,
    },
  });
});

/**
 * Verify and process school fees payment
 * Frontend sends transaction reference from Flutterwave callback
 * Backend verifies with Flutterwave API and credits wallet if successful
 * POST /api/courses/school-fees/verify
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

  // Check if already paid for this academic year
  const existingPayment = await SchoolFees.findOne({
    where: {
      student_id: studentId,
      academic_year: academicYear,
      status: "Paid",
    },
  });

  if (existingPayment) {
    throw new ErrorClass(
      "School fees for this academic year have already been paid",
      400
    );
  }

  // Get school fees configuration to verify amount
  const feesConfig = await getSchoolFeesForStudent(student, academicYear);

  if (!feesConfig) {
    throw new ErrorClass(
      "School fees not configured for your level/program in this academic year",
      404
    );
  }

  const expectedAmount = parseFloat(feesConfig.amount);
  const currency = feesConfig.currency;

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

  // Verify amount matches
  const transactionAmount = getTransactionAmount(flutterwaveTransaction);
  if (Math.abs(transactionAmount - expectedAmount) > 0.01) {
    throw new ErrorClass(
      `Payment amount mismatch. Expected: ${expectedAmount}, Received: ${transactionAmount}`,
      400
    );
  }

  // Verify currency matches
  const transactionCurrency = getTransactionCurrency(flutterwaveTransaction);
  if (transactionCurrency !== currency) {
    throw new ErrorClass("Payment currency mismatch", 400);
  }

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
    return res.status(200).json({
      success: true,
      message: "Payment already processed",
      data: {
        transaction: {
          transaction_reference: txRef,
          status: "successful",
          amount: transactionAmount,
        },
      },
    });
  }

  // Create payment transaction record
  const paymentTransaction = await PaymentTransaction.create({
    student_id: studentId,
    transaction_reference: txRef,
    flutterwave_transaction_id: flutterwaveTransaction.id?.toString(),
    amount: expectedAmount,
    currency: currency,
    status: "successful",
    payment_type: "school_fees",
    academic_year: academicYear,
    processed_at: new Date(),
    flutterwave_response: flutterwaveTransaction,
  });

  // Create SchoolFees record
  const schoolFee = await SchoolFees.create({
    student_id: studentId,
    amount: expectedAmount,
    status: "Paid",
    academic_year: academicYear,
    semester: null,
    date: today,
    teller_no: txRef,
    matric_number: student.matric_number,
    type: "School Fees",
    student_level: student.level,
    currency: currency,
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
  const newBalance = currentBalance + expectedAmount;

  const funding = await Funding.create({
    student_id: studentId,
    amount: expectedAmount,
    type: "Credit",
    service_name: "School Fees Payment",
    ref: txRef,
    date: today,
    semester: null,
    academic_year: academicYear,
    currency: currency,
    balance: newBalance.toString(),
  });

  // Update student wallet_balance
  await student.update({
    wallet_balance: newBalance,
  });

  res.status(200).json({
    success: true,
    message: "Payment verified and processed successfully",
    data: {
      payment: {
        id: schoolFee.id,
        amount: expectedAmount,
        currency: currency,
        academic_year: academicYear,
        payment_reference: txRef,
        date: today,
      },
      wallet: {
        previous_balance: currentBalance,
        new_balance: newBalance,
        credited: expectedAmount,
      },
    },
  });
});

