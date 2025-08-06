import { Students } from "../models/auth/student.js";
import { Staff } from "../models/auth/staff.js";
import { ErrorClass } from "../utils/errorClass/index.js";
import { TryCatchFunction } from "../utils/tryCatch/index.js";
import { authService } from "../service/authservice.js";

// Student Login using Sequelize ORM
export const studentLogin = TryCatchFunction(async (req, res) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    throw new ErrorClass("Email and password are required", 400);
  }

  try {
    // Find student by email using Sequelize ORM
    const student = await Students.findOne({
      where: {
        email: email.toLowerCase(),
      },
    });

    if (!student) {
      throw new ErrorClass("Invalid email or password", 401);
    }

    // Check admin status (using your existing field)
    if (student.admin_status === "inactive") {
      throw new ErrorClass(
        "Account is deactivated. Please contact administrator.",
        401
      );
    }

    // Compare password
    const isPasswordValid = await authService.comparePassword(
      password,
      student.password
    );

    if (!isPasswordValid) {
      throw new ErrorClass("Invalid email or password", 401);
    }

    // Update student record if needed (you can add a lastLogin field later)
    // await student.update({ lastLogin: new Date() });

    // Generate tokens using your actual model fields
    const accessToken = await authService.generateAccessToken({
      id: student.id,
      userType: "student",
      email: student.email,
      firstName: student.fname,
      lastName: student.lname,
      facultyId: student.faculty_id,
      programId: student.program_id,
      level: student.level,
    });

    const refreshToken = await authService.generateRefreshToken(student.id);

    // Prepare student data (exclude password and sensitive fields)
    const studentData = {
      id: student.id,
      firstName: student.fname,
      lastName: student.lname,
      email: student.email,
      gender: student.gender,
      phone: student.phone,
      level: student.level,
      matricNumber: student.matric_number,
      facultyId: student.faculty_id,
      programId: student.program_id,
      studyMode: student.study_mode,
      adminStatus: student.admin_status,
      walletBalance: student.wallet_balance,
    };

    res.status(200).json({
      success: true,
      message: "Student login successful",
      data: {
        user: studentData,
        accessToken,
        refreshToken,
        userType: "student",
        expiresIn: 900,
      },
    });
  } catch (error) {
    console.error("Database error:", error);
    throw new ErrorClass("Database connection error", 500);
  }
});

// Staff Login using Sequelize ORM
export const staffLogin = TryCatchFunction(async (req, res) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    throw new ErrorClass("Email and password are required", 400);
  }

  try {
    // Find staff by email using Sequelize ORM with associated courses
    const staff = await Staff.findOne({
      where: {
        email: email.toLowerCase(),
      },
      include: [
        {
          association: "courses", // This uses the association we defined
          required: false, // LEFT JOIN instead of INNER JOIN
        },
      ],
    });

    if (!staff) {
      throw new ErrorClass("Invalid email or password", 401);
    }

    // Compare password
    const isPasswordValid = await authService.comparePassword(
      password,
      staff.password
    );

    if (!isPasswordValid) {
      throw new ErrorClass("Invalid email or password", 401);
    }

    // Generate tokens
    const accessToken = await authService.generateAccessToken({
      id: staff.id,
      userType: "staff",
      email: staff.email,
      fullName: staff.full_name,
      phone: staff.phone,
    });

    const refreshToken = await authService.generateRefreshToken(staff.id);

    // Prepare staff data (exclude password)
    const staffData = {
      id: staff.id,
      fullName: staff.full_name,
      email: staff.email,
      phone: staff.phone,
      linkedin: staff.linkedin,
      googleScholar: staff.google_scholar,
      researchAreas: staff.research_areas,
      coursesCount: staff.courses ? staff.courses.length : 0,
    };

    res.status(200).json({
      success: true,
      message: "Staff login successful",
      data: {
        user: staffData,
        accessToken,
        refreshToken,
        userType: "staff",
        expiresIn: 900,
      },
    });
  } catch (error) {
    console.error("Database error:", error);
    throw new ErrorClass("Database connection error", 500);
  }
});

// Universal Login using Sequelize ORM
export const login = TryCatchFunction(async (req, res) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    throw new ErrorClass("Email and password are required", 400);
  }

  let user = null;
  let userType = null;

  // Try to find user in students table first
  const student = await Students.findOne({
    where: {
      email: email.toLowerCase(),
    },
  });

  if (student) {
    user = student;
    userType = "student";
  } else {
    // Try staff table if not found in students
    const staff = await Staff.findOne({
      where: {
        email: email.toLowerCase(),
      },
      include: [
        {
          association: "courses",
          required: false,
        },
      ],
    });

    if (staff) {
      user = staff;
      userType = "staff";
    }
  }

  if (!user) {
    throw new ErrorClass("user not found", 401);
  }

  // Check if user is active (for students, use admin_status)
  if (userType === "student" && user.admin_status === "inactive") {
    throw new ErrorClass(
      "Account is deactivated. Please contact administrator.",
      401
    );
  }

  // Compare password
  const isPasswordValid = await authService.comparePassword(
    password,
    user.password
  );

  if (!isPasswordValid) {
    throw new ErrorClass("Invalid email or password", 401);
  }

  // Generate tokens with appropriate payload
  const tokenPayload = {
    id: user.id,
    userType,
    email: user.email,
  };

  if (userType === "student") {
    tokenPayload.firstName = user.fname;
    tokenPayload.lastName = user.lname;
    tokenPayload.level = user.level;
    tokenPayload.facultyId = user.faculty_id;
  } else {
    tokenPayload.fullName = user.full_name;
    tokenPayload.phone = user.phone;
  }

  const accessToken = await authService.generateAccessToken(tokenPayload);
  const refreshToken = await authService.generateRefreshToken(user.id);

  // Prepare user data based on type
  let userData = {
    id: user.id,
    email: user.email,
    userType,
  };

  if (userType === "student") {
    userData = {
      ...userData,
      firstName: user.fname,
      lastName: user.lname,
      gender: user.gender,
      phone: user.phone,
      level: user.level,
      matricNumber: user.matric_number,
      facultyId: user.faculty_id,
      programId: user.program_id,
      studyMode: user.study_mode,
      adminStatus: user.admin_status,
      walletBalance: user.wallet_balance,
    };
  } else {
    userData = {
      ...userData,
      fullName: user.full_name,
      phone: user.phone,
      linkedin: user.linkedin,
      googleScholar: user.google_scholar,
      researchAreas: user.research_areas,
      coursesCount: user.courses ? user.courses.length : 0,
    };
  }

  res.status(200).json({
    success: true,
    message: "Login successful",
    data: {
      user: userData,
      accessToken,
      refreshToken,
      userType,
      expiresIn: 900,
    },
  });
});

// Get user profile with associations
export const getProfile = TryCatchFunction(async (req, res) => {
  const { userType, id } = req.user; // From JWT middleware

  let user = null;

  if (userType === "student") {
    user = await Students.findByPk(id, {
      attributes: { exclude: ["password", "token"] }, // Exclude sensitive fields
    });
  } else if (userType === "staff") {
    user = await Staff.findByPk(id, {
      include: [
        {
          association: "courses",
          required: false,
        },
      ],
      attributes: { exclude: ["password", "token"] },
    });
  }

  if (!user) {
    throw new ErrorClass("User not found", 404);
  }

  res.status(200).json({
    success: true,
    message: "Profile retrieved successfully",
    data: {
      user,
      userType,
    },
  });
});

// Refresh token endpoint
export const refreshToken = TryCatchFunction(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new ErrorClass("Refresh token is required", 400);
  }

  try {
    const newAccessToken = await authService.refreshAccessToken(refreshToken);

    res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
      data: {
        accessToken: newAccessToken,
        expiresIn: 900,
      },
    });
  } catch (error) {
    throw new ErrorClass("Invalid refresh token", 401);
  }
});

// Logout
export const logout = TryCatchFunction(async (req, res) => {
  // Optional: You could invalidate the refresh token here
  // by storing it in a blacklist or removing it from database

  res.status(200).json({
    success: true,
    message: "Logout successful",
  });
});

// Update student profile
export const updateStudentProfile = TryCatchFunction(async (req, res) => {
  const { id } = req.user;
  const updateData = req.body;

  // Remove sensitive fields that shouldn't be updated via this endpoint
  delete updateData.password;
  delete updateData.email;
  delete updateData.matric_number;
  delete updateData.admin_status;

  const student = await Students.findByPk(id);

  if (!student) {
    throw new ErrorClass("Student not found", 404);
  }

  await student.update(updateData);

  // Return updated student data (excluding sensitive fields)
  const updatedStudent = await Students.findByPk(id, {
    attributes: { exclude: ["password", "token"] },
  });

  res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    data: {
      user: updatedStudent,
    },
  });
});

// Update staff profile
export const updateStaffProfile = TryCatchFunction(async (req, res) => {
  const { id } = req.user;
  const updateData = req.body;

  // Remove sensitive fields
  delete updateData.password;
  delete updateData.email;

  const staff = await Staff.findByPk(id);

  if (!staff) {
    throw new ErrorClass("Staff not found", 404);
  }

  await staff.update(updateData);

  // Return updated staff data with courses
  const updatedStaff = await Staff.findByPk(id, {
    include: [
      {
        association: "courses",
        required: false,
      },
    ],
    attributes: { exclude: ["password", "token"] },
  });

  res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    data: {
      user: updatedStaff,
    },
  });
});
