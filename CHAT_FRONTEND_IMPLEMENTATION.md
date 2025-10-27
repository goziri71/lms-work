# 💬 Chat System Frontend Implementation Guide

## 📋 **Complete Frontend Examples for All Chat Features**

---

## 🎯 **1. INITIALIZE SOCKET CONNECTION**

```javascript
import io from "socket.io-client";

class ChatService {
  constructor(token) {
    this.socket = io("http://localhost:3000", {
      auth: { token },
      query: { token },
    });

    this.setupListeners();
  }

  setupListeners() {
    // Listen for new messages
    this.socket.on("dm:newMessage", (message) => {
      this.onNewMessage(message);
    });

    // Listen for online/offline status
    this.socket.on("dm:online", ({ userId, userType, isOnline }) => {
      this.onUserStatusChange(userId, isOnline);
    });

    // Listen for typing indicator
    this.socket.on("dm:typing", ({ userId, isTyping }) => {
      this.onTypingIndicator(userId, isTyping);
    });

    // Listen for message status updates
    this.socket.on("dm:delivered", ({ messageId, delivered_at }) => {
      this.onMessageDelivered(messageId);
    });

    this.socket.on("dm:read", ({ messageId, read_at }) => {
      this.onMessageRead(messageId);
    });
  }

  // Callbacks for frontend to implement
  onNewMessage(message) {}
  onUserStatusChange(userId, isOnline) {}
  onTypingIndicator(userId, isTyping) {}
  onMessageDelivered(messageId) {}
  onMessageRead(messageId) {}
}
```

---

## 💬 **2. JOIN A CHAT**

```javascript
async joinChat(peerUserId, peerUserType) {
  return new Promise((resolve, reject) => {
    this.socket.emit('dm:join', { peerUserId, peerUserType }, (response) => {
      if (response.ok) {
        resolve(response.messages);
      } else {
        reject(new Error(response.error));
      }
    });
  });
}

// Usage:
const messages = await chatService.joinChat(8, 'staff');
console.log(messages); // Array of last 100 messages
```

---

## 📤 **3. SEND A MESSAGE**

```javascript
async sendMessage(peerUserId, peerUserType, messageText) {
  return new Promise((resolve, reject) => {
    this.socket.emit(
      'dm:send',
      { peerUserId, peerUserType, message_text: messageText },
      (response) => {
        if (response.ok) {
          resolve(response.message);
        } else {
          reject(new Error(response.error));
        }
      }
    );
  });
}

// Usage:
const message = await chatService.sendMessage(8, 'staff', 'Hello!');
console.log(message); // Sent message object
```

---

## ✅ **4. MARK MESSAGE AS DELIVERED**

```javascript
async markDelivered(messageId) {
  this.socket.emit('dm:delivered', { messageId }, (response) => {
    if (!response.ok) {
      console.error('Failed to mark delivered:', response.error);
    }
  });
}

// Usage: Call when message appears on screen
chatService.markDelivered(messageId);
```

---

## 👁️ **5. MARK MESSAGE AS READ**

```javascript
async markRead(messageId) {
  return new Promise((resolve, reject) => {
    this.socket.emit('dm:read', { messageId }, (response) => {
      if (response.ok) {
        resolve();
      } else {
        reject(new Error(response.error));
      }
    });
  });
}

// Usage: Call when user opens chat
await chatService.markRead(messageId);
```

---

## ⌨️ **6. TYPING INDICATOR**

```javascript
let typingTimeout;

startTyping(peerUserId, peerUserType) {
  // Clear existing timeout
  clearTimeout(typingTimeout);

  // Emit typing started
  this.socket.emit('dm:typing', {
    peerUserId,
    peerUserType,
    isTyping: true
  });

  // Auto-stop after 3 seconds
  typingTimeout = setTimeout(() => {
    this.socket.emit('dm:typing', {
      peerUserId,
      peerUserType,
      isTyping: false
    });
  }, 3000);
}

stopTyping(peerUserId, peerUserType) {
  clearTimeout(typingTimeout);
  this.socket.emit('dm:typing', {
    peerUserId,
    peerUserType,
    isTyping: false
  });
}
```

---

## 📥 **7. LOAD MORE MESSAGES (Pagination)**

```javascript
async loadMoreMessages(peerUserId, peerUserType, beforeMessageId, limit = 50) {
  return new Promise((resolve, reject) => {
    this.socket.emit('dm:loadMore', {
      peerUserId,
      peerUserType,
      beforeMessageId,
      limit
    }, (response) => {
      if (response.ok) {
        resolve(response.messages);
      } else {
        reject(new Error(response.error));
      }
    });
  });
}

// Usage: When scrolling up to load older messages
const olderMessages = await chatService.loadMoreMessages(
  peerUserId,
  peerUserType,
  oldestMessageId
);
```

---

## 🟢 **8. CHECK ONLINE STATUS**

```javascript
async checkOnlineStatus(userIds) {
  return new Promise((resolve, reject) => {
    this.socket.emit('dm:checkOnline', { userIds }, (response) => {
      if (response.ok) {
        resolve(response.status);
      } else {
        reject(new Error(response.error));
      }
    });
  });
}

// Usage:
const status = await chatService.checkOnlineStatus([1, 2, 3]);
// Returns: [{ userId: 1, isOnline: true }, ...]
```

---

## 🎨 **COMPLETE REACT COMPONENT EXAMPLE**

```javascript
import { useState, useEffect, useRef } from "react";

function ChatComponent({
  currentUserId,
  currentUserType,
  peerUserId,
  peerUserType,
  token,
}) {
  const [messages, setMessages] = useState([]);
  const [isOnline, setIsOnline] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [inputText, setInputText] = useState("");
  const socketRef = useRef(null);

  useEffect(() => {
    // Initialize socket
    const socket = io("http://localhost:3000", {
      auth: { token },
      query: { token },
    });
    socketRef.current = socket;

    // Listen for online status
    socket.on("dm:online", ({ userId, isOnline: status }) => {
      if (userId === peerUserId) {
        setIsOnline(status);
      }
    });

    // Listen for new messages
    socket.on("dm:newMessage", (message) => {
      setMessages((prev) => [...prev, message]);

      // Mark as delivered if we're the receiver
      if (message.receiver_id === currentUserId) {
        socket.emit("dm:delivered", { messageId: message.id });
      }
    });

    // Listen for typing
    socket.on("dm:typing", ({ isTyping: typing }) => {
      setIsTyping(typing);
    });

    // Join the chat
    socket.emit("dm:join", { peerUserId, peerUserType }, (response) => {
      if (response.ok) {
        setMessages(response.messages.reverse()); // Oldest first
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [peerUserId, peerUserType]);

  const sendMessage = () => {
    if (!inputText.trim()) return;

    socketRef.current.emit(
      "dm:send",
      {
        peerUserId,
        peerUserType,
        message_text: inputText,
      },
      (response) => {
        if (response.ok) {
          setMessages((prev) => [...prev, response.message]);
          setInputText("");
        }
      }
    );
  };

  const handleTyping = (e) => {
    setInputText(e.target.value);

    // Emit typing
    socketRef.current.emit("dm:typing", {
      peerUserId,
      peerUserType,
      isTyping: true,
    });

    // Auto-stop typing after 2 seconds
    clearTimeout(window.typingTimeout);
    window.typingTimeout = setTimeout(() => {
      socketRef.current.emit("dm:typing", {
        peerUserId,
        peerUserType,
        isTyping: false,
      });
    }, 2000);
  };

  return (
    <div className="chat-container">
      {/* Status indicator */}
      <div className={`status ${isOnline ? "online" : "offline"}`}>
        {isOnline ? "🟢 Online" : "⚪ Offline"}
      </div>

      {/* Typing indicator */}
      {isTyping && <div className="typing">Typing...</div>}

      {/* Messages */}
      <div className="messages">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`message ${
              msg.sender_id === currentUserId ? "sent" : "received"
            }`}
          >
            <p>{msg.message_text}</p>
            <span className="timestamp">
              {new Date(msg.created_at).toLocaleTimeString()}
            </span>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="input-container">
        <input
          type="text"
          value={inputText}
          onChange={handleTyping}
          onKeyPress={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Type a message..."
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}

export default ChatComponent;
```

---

## 📡 **API ENDPOINTS (REST API)**

```javascript
// 1. Get chat list (threads)
async function getChatList(token) {
  const response = await fetch("http://localhost:3000/api/chat/dm/threads", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return await response.json();
}

// 2. Send message via REST (alternative to socket)
async function sendMessageViaAPI(peerUserId, peerUserType, messageText, token) {
  const response = await fetch("http://localhost:3000/api/chat/dm/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      peerUserId,
      peerUserType,
      message_text: messageText,
    }),
  });
  return await response.json();
}
```

---

## 🎯 **IMPLEMENTATION CHECKLIST**

- [ ] Install Socket.io client: `npm install socket.io-client`
- [ ] Create ChatService class
- [ ] Initialize socket with JWT token
- [ ] Implement join chat
- [ ] Implement send message
- [ ] Implement typing indicator
- [ ] Implement online status
- [ ] Implement message delivery status
- [ ] Implement message read status
- [ ] Handle disconnect/reconnect

---

## ⚠️ **IMPORTANT NOTES**

1. **Token Required:** Pass JWT token when initializing socket
2. **Auto-Reconnect:** Socket.io automatically reconnects
3. **Room Cleanup:** Leave previous chat room before joining new one
4. **Typing Timeout:** Auto-stop typing after 2-3 seconds
5. **Message Ordering:** Reverse array if needed (oldest first)

---

**All socket events are working and ready for frontend integration!** 🚀
