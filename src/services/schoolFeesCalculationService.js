import { PaymentSetup } from "../models/payment/paymentSetup.js";
import { SchoolFeesConfiguration } from "../models/payment/schoolFeesConfiguration.js";

/**
 * Calculate school fees for a student
 * Uses Option 3: Payment Setup (standard) + School Fees Configuration (override)
 * 
 * Flow:
 * 1. Sum Payment Setup items for semester/currency (default/standard)
 * 2. Check if School Fees Configuration exists for student
 * 3. If Configuration exists → use it as override
 * 4. If not → use Payment Setup total
 * 
 * @param {Object} student - Student object (must have id, level, program_id, facaulty_id, currency)
 * @param {string} academicYear - Academic year (e.g., "2025/2026")
 * @param {string} semester - Semester ("1ST" or "2ND")
 * @param {string} currency - Currency code (defaults to student's currency)
 * @returns {Promise<{amount: number, currency: string, source: 'payment_setup'|'configuration', items: Array, configuration?: Object}>}
 */
export async function calculateSchoolFeesForStudent(
  student,
  academicYear,
  semester,
  currency = null
) {
  const studentCurrency = currency || student.currency || "NGN";

  // Step 1: Get standard fees from Payment Setup (sum all items for semester/currency)
  const paymentSetupItems = await PaymentSetup.findAll({
    where: {
      semester: semester.toUpperCase(),
      currency: studentCurrency.toUpperCase(),
    },
    order: [["item", "ASC"]],
  });

  // Calculate total from Payment Setup items
  const paymentSetupTotal = paymentSetupItems.reduce((sum, item) => {
    return sum + (parseInt(item.amount) || 0);
  }, 0);

  // Step 2: Check if School Fees Configuration exists for this student (override)
  // We don't need to include Program/Faculty associations - we just check program_id and faculty_id directly
  const configs = await SchoolFeesConfiguration.findAll({
    where: {
      academic_year: academicYear.toString(),
      is_active: true,
    },
    attributes: ["id", "academic_year", "level", "program_id", "faculty_id", "amount", "currency", "description"],
  });

  // Find most specific match (same logic as getSchoolFeesForStudent)
  let bestMatch = null;
  let bestScore = 0;

  for (const config of configs) {
    let score = 0;
    let matches = true;

    // Check program match
    if (config.program_id) {
      if (student.program_id === config.program_id) {
        score += 4; // Highest priority
      } else {
        matches = false;
      }
    }

    // Check faculty match
    if (config.faculty_id) {
      if (student.facaulty_id === config.faculty_id) {
        score += 2;
      } else if (!config.program_id) {
        // Only fail if no program_id specified
        matches = false;
      }
    }

    // Check level match
    if (config.level) {
      if (student.level === config.level) {
        score += 1;
      } else {
        matches = false;
      }
    }

    // Check currency match
    if (config.currency && config.currency.toUpperCase() !== studentCurrency.toUpperCase()) {
      matches = false;
    }

    if (matches && score > bestScore) {
      bestScore = score;
      bestMatch = config;
    }
  }

  // Step 3: Determine final amount
  let finalAmount;
  let source;
  let configuration = null;

  if (bestMatch) {
    // Configuration exists → use it as override
    finalAmount = parseFloat(bestMatch.amount);
    source = "configuration";
    configuration = {
      id: bestMatch.id,
      level: bestMatch.level,
      program_id: bestMatch.program_id,
      faculty_id: bestMatch.faculty_id,
      description: bestMatch.description,
    };
  } else {
    // No configuration → use Payment Setup total (standard)
    finalAmount = paymentSetupTotal;
    source = "payment_setup";
  }

  // Format items for response
  const items = paymentSetupItems.map((item) => ({
    id: item.id,
    item: item.item,
    amount: parseInt(item.amount) || 0,
    description: item.description || "",
  }));

  return {
    amount: finalAmount,
    currency: studentCurrency,
    source: source, // 'payment_setup' or 'configuration'
    items: items, // Itemized breakdown from Payment Setup
    payment_setup_total: paymentSetupTotal, // Total from Payment Setup
    configuration: configuration, // Configuration details if override was used
  };
}

/**
 * Get school fees configuration for a specific student (helper function)
 * This is the same logic as in schoolFeesManagement.js but exported here for reuse
 */
export async function getSchoolFeesConfigurationForStudent(student, academicYear) {
  // We don't need to include Program/Faculty associations - we just check program_id and faculty_id directly
  const configs = await SchoolFeesConfiguration.findAll({
    where: {
      academic_year: academicYear.toString(),
      is_active: true,
    },
    attributes: ["id", "academic_year", "level", "program_id", "faculty_id", "amount", "currency", "description"],
  });

  // Find most specific match
  let bestMatch = null;
  let bestScore = 0;

  for (const config of configs) {
    let score = 0;
    let matches = true;

    // Check program match
    if (config.program_id) {
      if (student.program_id === config.program_id) {
        score += 4; // Highest priority
      } else {
        matches = false;
      }
    }

    // Check faculty match
    if (config.faculty_id) {
      if (student.facaulty_id === config.faculty_id) {
        score += 2;
      } else if (!config.program_id) {
        // Only fail if no program_id specified
        matches = false;
      }
    }

    // Check level match
    if (config.level) {
      if (student.level === config.level) {
        score += 1;
      } else {
        matches = false;
      }
    }

    if (matches && score > bestScore) {
      bestScore = score;
      bestMatch = config;
    }
  }

  return bestMatch;
}
