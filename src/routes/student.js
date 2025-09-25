import { Router } from "express";
import { authorize } from "../middlewares/authorize.js";
import {
  getAllStudents,
  getStudentById,
} from "../controllers/student/index.js";

const router = Router();

// Get all students with pagination, search, and filtering
router.get("/", authorize, getAllStudents);

// Get student by ID
router.get("/:id", authorize, getStudentById);

export default router;
