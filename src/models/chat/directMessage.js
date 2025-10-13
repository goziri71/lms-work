import mongoose from "mongoose";

const DirectMessageSchema = new mongoose.Schema(
  {
    // roomKey is a stable, sorted composite of (type:id)-(type:id)
    // Example: dm:staff:12-student:45 (lexicographically sorted)
    roomKey: { type: String, required: true, index: true },
    senderType: { type: String, enum: ["student", "staff"], required: true },
    senderId: { type: Number, required: true, index: true },
    receiverType: { type: String, enum: ["student", "staff"], required: true },
    receiverId: { type: Number, required: true, index: true },
    messageText: { type: String, required: true },
    deliveredAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

DirectMessageSchema.index(
  { roomKey: 1, created_at: -1 },
  { name: "dm_history_idx" }
);

export const DirectMessage =
  mongoose.models.DirectMessage ||
  mongoose.model("DirectMessage", DirectMessageSchema);
