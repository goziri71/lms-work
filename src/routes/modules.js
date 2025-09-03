import { Router } from "express";
import { authorize } from "../middlewares/authorize.js";
import {
  createModule,
  getModulesByCourse,
  updateModule,
  deleteModule,
  createUnit,
  getUnitsByModule,
  updateUnit,
  deleteUnit,
} from "../controllers/modules/index.js";

const router = Router();

// Modules
router.post("/courses/:courseId/modules", authorize, createModule);
router.get("/courses/:courseId/modules", authorize, getModulesByCourse);
router.patch("/modules/:moduleId", authorize, updateModule);
router.delete("/modules/:moduleId", authorize, deleteModule);

// Units
router.post("/modules/:moduleId/units", authorize, createUnit);
router.get("/modules/:moduleId/units", authorize, getUnitsByModule);
router.patch("/units/:unitId", authorize, updateUnit);
router.delete("/units/:unitId", authorize, deleteUnit);

export default router;
