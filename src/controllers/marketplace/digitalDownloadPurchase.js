import { DigitalDownloads } from "../../models/marketplace/digitalDownloads.js";
import { Students } from "../../models/auth/student.js";
import { DigitalDownloadPurchase } from "../../models/marketplace/digitalDownloadPurchase.js";
import { Funding } from "../../models/payment/funding.js";
import { GeneralSetup } from "../../models/settings/generalSetup.js";
import { processMarketplacePurchase } from "../../services/revenueSharingService.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { getWalletBalance } from "../../services/walletBalanceService.js";

/**
 * Purchase marketplace digital download
 * This handles payment processing and revenue distribution
 */
export const purchaseDigitalDownload = TryCatchFunction(async (req, res) => {
  const { digital_download_id } = req.body;
  const studentId = req.user?.id;

  if (req.user?.userType !== "student") {
    throw new ErrorClass("Only students can purchase digital downloads", 403);
  }

  if (!digital_download_id) {
    throw new ErrorClass("Digital download ID is required", 400);
  }

  // Verify digital download exists and is published
  const download = await DigitalDownloads.findByPk(digital_download_id);
  if (!download) {
    throw new ErrorClass("Digital download not found", 404);
  }

  if (download.status !== "published") {
    throw new ErrorClass("This product is not available for purchase", 400);
  }

  // Validate price (can be 0 for free products)
  const productPrice = parseFloat(download.price || 0);
  if (productPrice < 0) {
    throw new ErrorClass("Product price is invalid", 400);
  }

  // Verify student exists
  const student = await Students.findByPk(studentId);
  if (!student) {
    throw new ErrorClass("Student not found", 404);
  }

  // Check if already purchased
  const existingPurchase = await DigitalDownloadPurchase.findOne({
    where: {
      digital_download_id: digital_download_id,
      student_id: studentId,
    },
  });

  if (existingPurchase) {
    throw new ErrorClass("You already own this product", 400);
  }

  // Get exchange rate from system settings (USD to NGN)
  const generalSetup = await GeneralSetup.findOne({
    order: [["id", "DESC"]],
  });
  const exchangeRate = parseFloat(generalSetup?.rate || "1500"); // Default 1500 if not set

  // Get currencies
  const productCurrency = (download.currency || "NGN").toUpperCase();
  const studentCurrency = (student.currency || "NGN").toUpperCase();

  // Convert product price to student's currency if they differ
  let priceInStudentCurrency = productPrice;
  if (productCurrency !== studentCurrency) {
    if (productCurrency === "USD" && studentCurrency === "NGN") {
      // USD to NGN: multiply by exchange rate
      priceInStudentCurrency = productPrice * exchangeRate;
    } else if (productCurrency === "NGN" && studentCurrency === "USD") {
      // NGN to USD: divide by exchange rate
      priceInStudentCurrency = productPrice / exchangeRate;
    }
    // Round to 2 decimal places
    priceInStudentCurrency = Math.round(priceInStudentCurrency * 100) / 100;
  }

  // All transactions use wallet balance
  // Check wallet balance (with automatic migration of old balances)
  const { balance: walletBalance } = await getWalletBalance(studentId, true);

  // Check if wallet has sufficient balance (compare in student's currency)
  if (walletBalance < priceInStudentCurrency) {
    let requiredDisplay;
    if (productCurrency !== studentCurrency) {
      requiredDisplay = `${priceInStudentCurrency.toFixed(2)} ${studentCurrency} (${productPrice} ${productCurrency})`;
    } else {
      requiredDisplay = `${priceInStudentCurrency.toFixed(2)} ${studentCurrency}`;
    }
    
    throw new ErrorClass(
      `Insufficient wallet balance. Required: ${requiredDisplay}, Available: ${walletBalance.toFixed(2)} ${studentCurrency}. Please fund your wallet first.`,
      400
    );
  }

  // Generate transaction reference for wallet debit
  const txRef = `DIGITAL-DOWNLOAD-${digital_download_id}-${Date.now()}`;
  const today = new Date().toISOString().split("T")[0];

  // Debit wallet (in student's currency)
  const newBalance = walletBalance - priceInStudentCurrency;

  // Create Funding transaction (Debit) - store in student's currency
  await Funding.create({
    student_id: studentId,
    amount: priceInStudentCurrency,
    type: "Debit",
    service_name: "Digital Download Purchase",
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

  // Process marketplace purchase and distribute revenue
  // Note: processMarketplacePurchase expects course_id, so we need to adapt or create new service
  // For now, we'll handle revenue sharing directly here
  const ownerType = download.owner_type;
  const ownerId = download.owner_id;

  // Get commission rate from owner (sole tutor or organization)
  let commissionRate = 15; // Default commission rate
  if (ownerType === "sole_tutor") {
    const { SoleTutor } = await import("../../models/marketplace/soleTutor.js");
    const owner = await SoleTutor.findByPk(ownerId);
    if (owner && owner.commission_rate !== null && owner.commission_rate !== undefined) {
      commissionRate = parseFloat(owner.commission_rate);
    }
  } else if (ownerType === "organization") {
    const { Organization } = await import("../../models/marketplace/organization.js");
    const owner = await Organization.findByPk(ownerId);
    if (owner && owner.commission_rate !== null && owner.commission_rate !== undefined) {
      commissionRate = parseFloat(owner.commission_rate);
    }
  }

  // Calculate revenue split
  const wspCommission = (productPrice * commissionRate) / 100;
  const tutorEarnings = productPrice - wspCommission;

  // Create purchase record
  await DigitalDownloadPurchase.create({
    digital_download_id: digital_download_id,
    student_id: studentId,
    owner_type: ownerType,
    owner_id: ownerId,
    price: productPrice,
    currency: productCurrency,
    commission_rate: commissionRate,
    wsp_commission: wspCommission,
    tutor_earnings: tutorEarnings,
    transaction_ref: txRef,
  });

  // Update sales count
  await download.update({
    sales_count: download.sales_count + 1,
  });

  // Build response
  res.status(201).json({
    success: true,
    message: productPrice === 0 
      ? "Free product added to your library" 
      : "Product purchased successfully",
    data: {
      purchase: {
        digital_download_id: digital_download_id,
        product_type: download.product_type,
        price: productPrice,
        currency: productCurrency,
        transaction_ref: txRef,
      },
      revenue: {
        wsp_commission: wspCommission,
        tutor_earnings: tutorEarnings,
        commission_rate: commissionRate,
      },
      wallet: {
        previous_balance: walletBalance,
        new_balance: newBalance,
        debited: priceInStudentCurrency,
        currency: studentCurrency,
        product_price_original: productCurrency !== studentCurrency ? {
          amount: productPrice,
          currency: productCurrency,
        } : null,
      },
    },
  });
});

