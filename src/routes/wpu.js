import express from "express";
import { authorize } from "../middlewares/authorize.js";
import { listWpuBooks } from "../controllers/wpu/wpuBooks.js";

const router = express.Router();

router.get("/books", authorize, listWpuBooks);

export default router;
