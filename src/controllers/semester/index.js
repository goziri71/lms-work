import { TryCatchFunction } from "../../utils/tryCatch/index.js";
import { ErrorClass } from "../../utils/errorClass/index.js";
import { Semester } from "../../models/auth/semester.js";
import { Students } from "../../models/auth/student.js";
import { Staff } from "../../models/auth/staff.js";

export const getSemester = TryCatchFunction(async (req, res) => {
  const userId = Number(req.user?.id);
  if (!userId) {
    throw new ErrorClass("Invalid user id", 400);
  }
  const student = await Students.findByPk(userId);
  const staff = await Staff.findByPk(userId);

  if (!student && !staff) {
    throw new ErrorClass("User not found", 404);
  }
  const semesters = await Semester.findAll();
  if (!semesters || semesters.length === 0) {
    throw new ErrorClass("Semesters not found", 404);
  }
  res.status(200).json({
    status: true,
    code: 200,
    message: "Semesters fetched successfully",
    data: semesters,
  });
});
