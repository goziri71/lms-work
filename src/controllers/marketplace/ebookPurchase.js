import { EBooks } from "../../models/marketplace/ebooks.js";
import { Students } from "../../models/auth/student.js";
import { EBookPurchase } from "../../models/marketplace/ebookPurchase.js";
import { Funding } from "../../models/payment/funding.js";
import { GeneralSetup } from "../../models/settings/generalSetup.js";
import { processMarketplacePurchase } from "../../services/revenueSharingService.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { getWalletBalance } from "../../services/walletBalanceService.js";

/**
 * Purchase marketplace e-book
 * This handles payment processing and revenue distribution
 */
export const purchaseEBook = TryCatchFunction(async (req, res) => {
  const { ebook_id } = req.body;
  const studentId = req.user?.id;

  if (req.user?.userType !== "student") {
    throw new ErrorClass("Only students can purchase e-books", 403);
  }

  if (!ebook_id) {
    throw new ErrorClass("E-book ID is required", 400);
  }

  // Verify e-book exists and is published
  const ebook = await EBooks.findByPk(ebook_id);
  if (!ebook) {
    throw new ErrorClass("E-book not found", 404);
  }

  if (ebook.status !== "published") {
    throw new ErrorClass("This e-book is not available for purchase", 400);
  }

  // Validate e-book price (can be 0 for free e-books)
  const ebookPrice = parseFloat(ebook.price || 0);
  if (ebookPrice < 0) {
    throw new ErrorClass("E-book price is invalid", 400);
  }

  // Verify student exists
  const student = await Students.findByPk(studentId);
  if (!student) {
    throw new ErrorClass("Student not found", 404);
  }

  // Check if already purchased
  const existingPurchase = await EBookPurchase.findOne({
    where: {
      ebook_id: ebook_id,
      student_id: studentId,
    },
  });

  if (existingPurchase) {
    throw new ErrorClass("You already own this e-book", 400);
  }

  // Get exchange rate from system settings (USD to NGN)
  const generalSetup = await GeneralSetup.findOne({
    order: [["id", "DESC"]],
  });
  const exchangeRate = parseFloat(generalSetup?.rate || "1500"); // Default 1500 if not set

  // Get currencies
  const ebookCurrency = (ebook.currency || "NGN").toUpperCase();
  const studentCurrency = (student.currency || "NGN").toUpperCase();

  // Convert e-book price to student's currency if they differ
  let priceInStudentCurrency = ebookPrice;
  if (ebookCurrency !== studentCurrency) {
    if (ebookCurrency === "USD" && studentCurrency === "NGN") {
      // USD to NGN: multiply by exchange rate
      priceInStudentCurrency = ebookPrice * exchangeRate;
    } else if (ebookCurrency === "NGN" && studentCurrency === "USD") {
      // NGN to USD: divide by exchange rate
      priceInStudentCurrency = ebookPrice / exchangeRate;
    }
    // Round to 2 decimal places to avoid floating point precision issues
    priceInStudentCurrency = Math.round(priceInStudentCurrency * 100) / 100;
  }

  // Check wallet balance if price > 0
  if (priceInStudentCurrency > 0) {
    const { balance: walletBalance } = await getWalletBalance(studentId, true);

    // Check if wallet has sufficient balance
    if (walletBalance < priceInStudentCurrency) {
      // Format amounts for display
      let requiredDisplay;
      if (ebookCurrency !== studentCurrency) {
        requiredDisplay = `${priceInStudentCurrency.toFixed(2)} ${studentCurrency} (${ebookPrice} ${ebookCurrency})`;
      } else {
        requiredDisplay = `${priceInStudentCurrency.toFixed(2)} ${studentCurrency}`;
      }

      throw new ErrorClass(
        `Insufficient wallet balance. Required: ${requiredDisplay}, Available: ${walletBalance.toFixed(2)} ${studentCurrency}. Please fund your wallet first.`,
        400
      );
    }

    // Generate transaction reference for wallet debit
    const txRef = `EBOOK-${ebook_id}-${Date.now()}`;
    const today = new Date().toISOString().split("T")[0];

    // Debit wallet (in student's currency)
    const newBalance = walletBalance - priceInStudentCurrency;

    // Create Funding transaction (Debit) - store in student's currency
    await Funding.create({
      student_id: studentId,
      amount: priceInStudentCurrency,
      type: "Debit",
      service_name: "Marketplace E-Book Purchase",
      ref: txRef,
      date: today,
      semester: null,
      academic_year: null,
      currency: studentCurrency,
      balance: newBalance.toString(),
    });

    // Update student wallet_balance
    await student.update({
      wallet_balance: newBalance,
    });

    // Process marketplace purchase and distribute revenue (similar to courses)
    // Note: We'll use the same revenue sharing service but adapt it for e-books
    const commissionRate = parseFloat(process.env.MARKETPLACE_COMMISSION_RATE || "15"); // 15% default
    const wspCommission = (priceInStudentCurrency * commissionRate) / 100;
    const tutorEarnings = priceInStudentCurrency - wspCommission;

    // Create e-book purchase record
    await EBookPurchase.create({
      ebook_id: ebook_id,
      student_id: studentId,
      owner_type: ebook.owner_type,
      owner_id: ebook.owner_id,
      price: priceInStudentCurrency,
      currency: studentCurrency,
      commission_rate: commissionRate,
      wsp_commission: wspCommission,
      tutor_earnings: tutorEarnings,
      transaction_ref: txRef,
    });

    // Update e-book sales count
    await ebook.update({
      sales_count: ebook.sales_count + 1,
    });

    res.status(201).json({
      success: true,
      message: "E-book purchased successfully",
      data: {
        purchase: {
          ebook_id: ebook_id,
          price: priceInStudentCurrency,
          currency: studentCurrency,
          transaction_ref: txRef,
        },
        wallet: {
          previous_balance: walletBalance,
          new_balance: newBalance,
          debited: priceInStudentCurrency,
          currency: studentCurrency,
          ebook_price_original: ebookCurrency !== studentCurrency ? {
            amount: ebookPrice,
            currency: ebookCurrency,
          } : null,
        },
      },
    });
  } else {
    // Free e-book - no payment needed
    const txRef = `EBOOK-FREE-${ebook_id}-${Date.now()}`;

    // Create e-book purchase record (free)
    await EBookPurchase.create({
      ebook_id: ebook_id,
      student_id: studentId,
      owner_type: ebook.owner_type,
      owner_id: ebook.owner_id,
      price: 0,
      currency: studentCurrency,
      commission_rate: 0,
      wsp_commission: 0,
      tutor_earnings: 0,
      transaction_ref: txRef,
    });

    // Update e-book sales count
    await ebook.update({
      sales_count: ebook.sales_count + 1,
    });

    res.status(201).json({
      success: true,
      message: "Free e-book added to your library",
      data: {
        purchase: {
          ebook_id: ebook_id,
          price: 0,
          currency: studentCurrency,
          transaction_ref: txRef,
        },
      },
    });
  }
});

