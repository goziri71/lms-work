import mongoose from "mongoose";

const DirectMessageSchema = new mongoose.Schema(
  {
    roomKey: { type: String, required: true, index: true }, // sorted pair: userA-userB
    senderId: { type: Number, required: true, index: true },
    receiverId: { type: Number, required: true, index: true },
    messageText: { type: String, required: true },
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
