// Discussion socket end-to-end tester
// Usage:
//   node src/scripts/testDiscussions.js \
//     --url=http://localhost:3000 \
//     --token=YOUR_JWT \
//     --courseId=18 \
//     --year="2024/2025" \
//     --sem=2ND

import { io } from "socket.io-client";

function getArg(name, fallback = undefined) {
  const match = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!match) return fallback;
  return match.split("=").slice(1).join("=");
}

const SERVER_URL = getArg(
  "url",
  process.env.SOCKET_URL || "http://localhost:3000"
);
const TOKEN = getArg("token", process.env.TEST_JWT_TOKEN || "");
const COURSE_ID = Number(getArg("courseId", process.env.TEST_COURSE_ID || 0));
const ACADEMIC_YEAR = getArg("year", process.env.TEST_ACADEMIC_YEAR || "");
const SEMESTER = getArg("sem", process.env.TEST_SEMESTER || "");

if (!TOKEN || !COURSE_ID || !ACADEMIC_YEAR || !SEMESTER) {
  console.error(
    "❌ Missing required args. Provide --token, --courseId, --year, --sem"
  );
  process.exit(1);
}

console.log("\n🧪 Discussion Socket Test");
console.log("Server:", SERVER_URL);
console.log("Course:", { COURSE_ID, ACADEMIC_YEAR, SEMESTER });

const timings = {};
const t0 = Date.now();
function mark(label) {
  timings[label] = Date.now() - t0;
}

const socket = io(SERVER_URL, {
  auth: { token: TOKEN },
  transports: ["websocket", "polling"],
  timeout: 10000,
});

function exitWith(msg, code = 1) {
  console.log("\n⏱️ Timings (ms):", timings);
  if (msg) console.log(msg);
  try {
    socket.disconnect();
  } catch {}
  process.exit(code);
}

socket.on("connect_error", (err) => {
  console.error("❌ connect_error:", err?.message || err);
});

socket.on("connect", async () => {
  mark("connected");
  console.log("✅ Connected. Socket ID:", socket.id);

  // 1) Join discussion
  await new Promise((resolve) => {
    const payload = {
      courseId: COURSE_ID,
      academicYear: ACADEMIC_YEAR,
      semester: SEMESTER,
    };
    console.log("\n➡️  joinDiscussion ->", payload);
    const tJoin = Date.now();
    socket.emit("joinDiscussion", payload, (res) => {
      mark("join_cb");
      const took = Date.now() - tJoin;
      if (!res?.ok) {
        console.error("❌ joinDiscussion failed (", took, "ms):", res?.error);
        return exitWith();
      }
      console.log("✅ joinDiscussion ok (", took, "ms):", {
        discussionId: res.discussionId,
        messages: res.messages?.length,
      });
      resolve();
    });
  });

  // 2) Send message
  await new Promise((resolve) => {
    const payload = {
      courseId: COURSE_ID,
      academicYear: ACADEMIC_YEAR,
      semester: SEMESTER,
      message_text: `Test message @ ${new Date().toISOString()}`,
    };
    console.log("\n➡️  postMessage ->", payload.message_text);
    const tSend = Date.now();
    socket.emit("postMessage", payload, (res) => {
      mark("post_cb");
      const took = Date.now() - tSend;
      if (!res?.ok) {
        console.error("❌ postMessage failed (", took, "ms):", res?.error);
        return exitWith();
      }
      console.log("✅ postMessage ok (", took, "ms)", res.message);
      resolve();
    });
  });

  // 3) Load more (older) messages
  await new Promise((resolve) => {
    const payload = {
      courseId: COURSE_ID,
      academicYear: ACADEMIC_YEAR,
      semester: SEMESTER,
      limit: 20,
    };
    console.log("\n➡️  loadMoreMessages ->", payload);
    const tLoad = Date.now();
    socket.emit("loadMoreMessages", payload, (res) => {
      mark("load_cb");
      const took = Date.now() - tLoad;
      if (!res?.ok) {
        console.error("❌ loadMoreMessages failed (", took, "ms):", res?.error);
        return exitWith();
      }
      console.log("✅ loadMoreMessages ok (", took, "ms):", {
        count: res.messages?.length,
        hasMore: res.hasMore,
      });
      resolve();
    });
  });

  // Listen briefly for a broadcast
  console.log("\n👂 Waiting 1s for any broadcasts (newMessage)...");
  const waitTimer = setTimeout(() => {
    exitWith("\n✅ Test completed successfully!", 0);
  }, 1000);

  socket.on("newMessage", (m) => {
    console.log("📡 newMessage:", m);
    clearTimeout(waitTimer);
    exitWith("\n✅ Test completed successfully!", 0);
  });
});

socket.on("disconnect", (reason) => {
  console.log("🔌 Disconnected:", reason);
});
