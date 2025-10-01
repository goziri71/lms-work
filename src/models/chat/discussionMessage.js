import mongoose from "mongoose";

const DiscussionMessageSchema = new mongoose.Schema(
  {
    courseId: { type: Number, required: true, index: true },
    academicYear: { type: String, required: true, index: true },
    semester: { type: String, required: true, index: true },
    senderType: { type: String, enum: ["student", "staff"], required: true },
    senderId: { type: Number, required: true },
    messageText: { type: String, required: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

DiscussionMessageSchema.index(
  { courseId: 1, academicYear: 1, semester: 1, created_at: -1 },
  { name: "discussion_history_idx" }
);

export const DiscussionMessage =
  mongoose.models.DiscussionMessage ||
  mongoose.model("DiscussionMessage", DiscussionMessageSchema);
