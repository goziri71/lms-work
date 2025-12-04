import { Op } from "sequelize";
import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { Students } from "../../models/auth/student.js";
import { SchoolFees } from "../../models/payment/schoolFees.js";
import { SchoolFeesConfiguration } from "../../models/payment/schoolFeesConfiguration.js";
import { Funding } from "../../models/payment/funding.js";
import { Semester } from "../../models/auth/semester.js";
import { getSchoolFeesForStudent } from "../admin/superAdmin/schoolFeesManagement.js";

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
 * Pay school fees (with third-party payment API integration)
 * POST /api/courses/school-fees/pay
 */
export const paySchoolFees = TryCatchFunction(async (req, res) => {
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

  // Check if already paid
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

  // Get school fees configuration
  const feesConfig = await getSchoolFeesForStudent(student, academicYear);

  if (!feesConfig) {
    throw new ErrorClass(
      "School fees not configured for your level/program in this academic year",
      404
    );
  }

  const amount = parseFloat(feesConfig.amount);
  const currency = feesConfig.currency;

  // TODO: Integrate with third-party payment API (Paystack, Flutterwave, etc.)
  // For now, we'll simulate payment success
  // In production, you would:
  // 1. Initialize payment with third-party API
  // 2. Get payment reference
  // 3. Verify payment callback/webhook
  // 4. Then proceed with wallet credit

  const { payment_reference, payment_method = "online" } = req.body || {};

  // Simulate payment verification (replace with actual API call)
  // const paymentVerified = await verifyPaymentWithThirdParty(payment_reference);
  // if (!paymentVerified) {
  //   throw new ErrorClass("Payment verification failed", 400);
  // }

  // For now, assume payment is successful if reference is provided
  if (!payment_reference) {
    throw new ErrorClass(
      "Payment reference is required. Third-party payment integration pending.",
      400
    );
  }

  // Create SchoolFees record
  const schoolFee = await SchoolFees.create({
    student_id: studentId,
    amount: amount,
    status: "Paid",
    academic_year: academicYear,
    semester: null, // School fees are yearly, not per semester
    date: today,
    teller_no: payment_reference,
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

  // Credit wallet with school fees amount
  const newBalance = currentBalance + amount;

  const funding = await Funding.create({
    student_id: studentId,
    amount: amount,
    type: "Credit",
    service_name: "School Fees Payment",
    ref: payment_reference,
    date: today,
    semester: null, // School fees are yearly
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
    message: "School fees paid successfully and wallet credited",
    data: {
      payment: {
        id: schoolFee.id,
        amount: amount,
        currency: currency,
        academic_year: academicYear,
        payment_reference: payment_reference,
        date: today,
      },
      wallet: {
        previous_balance: currentBalance,
        new_balance: newBalance,
        credited: amount,
      },
      transaction: {
        id: funding.id,
        type: "Credit",
        service_name: "School Fees Payment",
        ref: payment_reference,
      },
    },
  });
});

