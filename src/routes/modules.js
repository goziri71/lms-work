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
  uploadUnitVideo,
  uploadMiddleware,
  upsertModuleNote,
  getModuleNote,
  deleteModuleNote,
  listDiscussions,
  createDiscussion,
  listDiscussionMessages,
  postDiscussionMessage,
  updateModuleNote,
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

// Upload unit video (multipart, field name: video)
router.post(
  "/modules/:moduleId/units/:unitId/video",
  authorize,
  uploadMiddleware,
  uploadUnitVideo
);

export default router;

// Notes (student) - module scoped
router.put("/modules/:moduleId/note", authorize, upsertModuleNote);
router.patch("/modules/:moduleId/notes/:noteId", authorize, updateModuleNote);
router.get("/modules/:moduleId/note", authorize, getModuleNote);
router.delete("/modules/:moduleId/notes/:noteId", authorize, deleteModuleNote);

// Discussions
router.get("/discussions", authorize, listDiscussions);
router.post("/discussions", authorize, createDiscussion);
router.get(
  "/discussions/:discussionId/messages",
  authorize,
  listDiscussionMessages
);
router.post(
  "/discussions/:discussionId/messages",
  authorize,
  postDiscussionMessage
);
