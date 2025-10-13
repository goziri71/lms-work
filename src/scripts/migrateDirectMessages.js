import { DirectMessage } from "../models/chat/directMessage.js";
import { Staff } from "../models/auth/staff.js";
import { Students } from "../models/auth/student.js";

function composite(userType, userId) {
  return `${String(userType)}:${Number(userId)}`;
}

function sortComposite(a, b) {
  return a.localeCompare(b) <= 0 ? [a, b] : [b, a];
}

export async function backfillDirectMessageTypes({ dryRun = true } = {}) {
  const cursor = DirectMessage.find({
    $or: [
      { senderType: { $exists: false } },
      { receiverType: { $exists: false } },
    ],
  }).cursor();
  let updated = 0;
  for await (const msg of cursor) {
    let senderType = msg.senderType;
    let receiverType = msg.receiverType;

    // Infer types by probing tables (best-effort)
    if (!senderType) {
      const [staff, student] = await Promise.all([
        Staff.findOne({
          where: { id: msg.senderId },
          attributes: ["id"],
          raw: true,
        }),
        Students.findOne({
          where: { id: msg.senderId },
          attributes: ["id"],
          raw: true,
        }),
      ]);
      senderType = staff ? "staff" : student ? "student" : undefined;
    }
    if (!receiverType) {
      const [staff, student] = await Promise.all([
        Staff.findOne({
          where: { id: msg.receiverId },
          attributes: ["id"],
          raw: true,
        }),
        Students.findOne({
          where: { id: msg.receiverId },
          attributes: ["id"],
          raw: true,
        }),
      ]);
      receiverType = staff ? "staff" : student ? "student" : undefined;
    }

    // If still unknown, skip and report
    if (!senderType || !receiverType) {
      // eslint-disable-next-line no-console
      console.warn("DM migrate: could not infer types for", {
        id: String(msg._id),
        senderId: msg.senderId,
        receiverId: msg.receiverId,
      });
      continue;
    }

    const ca = composite(senderType, msg.senderId);
    const cb = composite(receiverType, msg.receiverId);
    const [minC, maxC] = sortComposite(ca, cb);
    const newRoomKey = `${minC}-${maxC}`;

    if (!dryRun) {
      msg.senderType = senderType;
      msg.receiverType = receiverType;
      msg.roomKey = newRoomKey;
      await msg.save();
    }
    updated += 1;
  }
  return { updated };
}

// Allow running as a script: node src/scripts/migrateDirectMessages.js --apply
if (process.argv[1] && process.argv[1].includes("migrateDirectMessages.js")) {
  const apply = process.argv.includes("--apply");
  backfillDirectMessageTypes({ dryRun: !apply })
    .then((res) => {
      // eslint-disable-next-line no-console
      console.log(
        `DM migrate completed. Updated: ${res.updated}. DryRun: ${!apply}`
      );
      process.exit(0);
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error("DM migrate failed", err);
      process.exit(1);
    });
}
