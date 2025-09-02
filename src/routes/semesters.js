import { Router } from "express";
import { authorize } from "../middlewares/authorize.js";
import { getSemester } from "../controllers/semester/index.js";
const router = Router();

router.get("/get-semesters", authorize, getSemester);

export default router;
