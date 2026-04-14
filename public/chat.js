const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const chatMessages = document.getElementById("chatMessages");
const headerUserName = document.getElementById("headerUserName");
const sidebarUserPill = document.getElementById("sidebarUserPill");
const logoutButton = document.getElementById("logoutButton");
const renderedMessageIds = new Set();
const pollingIntervalMs = 15000;
const socketServerUrl = "http://localhost:3000";
const dateDividerMarkup = `
  <div class="date-divider">
    <span>Today</span>
  </div>
`;
let chatSocket;
let pollingIntervalId;
let reconnectTimeoutId;

function getStoredUser() {
  const rawUser = localStorage.getItem("chatUser");

  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser);
  } catch (error) {
    console.error("Unable to parse stored user:", error);
    return null;
  }
}

function redirectToLogin() {
  window.location.href = "/";
}

function ensureAuthenticated() {
  const token = localStorage.getItem("token");

  if (!token) {
    redirectToLogin();
    return false;
  }

  return true;
}

function getCurrentTime() {
  const now = new Date();
  return now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getToken() {
  return localStorage.getItem("token");
}

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function applyUserProfile() {
  const user = getStoredUser();
  const displayName = user?.name || "Guest";

  headerUserName.textContent = displayName;
  sidebarUserPill.textContent = displayName;
}

function clearMessages() {
  chatMessages.innerHTML = dateDividerMarkup;
  renderedMessageIds.clear();
}

function formatMessageTime(dateValue) {
  const date = dateValue ? new Date(dateValue) : new Date();
  return Number.isNaN(date.getTime()) ? getCurrentTime() : date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function createMessageElement({ text, type = "sent", senderName = "", createdAt }) {
  const row = document.createElement("div");
  row.className = `message-row ${type}`;

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";

  if (type === "received" && senderName) {
    const messageSender = document.createElement("div");
    messageSender.className = "message-sender";
    messageSender.textContent = senderName;
    bubble.appendChild(messageSender);
  }

  const messageText = document.createElement("div");
  messageText.className = "message-text";
  messageText.textContent = text;

  const messageTime = document.createElement("div");
  messageTime.className = "message-time";
  messageTime.textContent = formatMessageTime(createdAt);

  bubble.appendChild(messageText);
  bubble.appendChild(messageTime);
  row.appendChild(bubble);

  return row;
}

function appendMessage(message) {
  const messageId = String(message.id || "");

  if (messageId && renderedMessageIds.has(messageId)) {
    return;
  }

  if (messageId) {
    renderedMessageIds.add(messageId);
  }

  const messageElement = createMessageElement({
    text: message.message,
    type: getMessageType(message.userId),
    senderName: message.sender?.name || "Unknown",
    createdAt: message.createdAt
  });

  chatMessages.appendChild(messageElement);
  scrollToBottom();
}

function getMessageType(messageUserId) {
  const user = getStoredUser();
  return user && Number(user.id) === Number(messageUserId) ? "sent" : "received";
}

function renderMessages(messages) {
  clearMessages();

  messages.forEach((message) => {
    appendMessage(message);
  });
}

async function loadMessages() {
  try {
    const res = await fetch("/messages", {
      headers: {
        Authorization: `Bearer ${getToken()}`
      }
    });

    if (!res.ok) {
      throw new Error("Unable to load messages");
    }

    const data = await res.json();
    renderMessages(data.messages || []);
  } catch (error) {
    console.error("Error loading messages:", error);
  }
}

function startPolling() {
  if (pollingIntervalId) {
    return;
  }

  pollingIntervalId = window.setInterval(() => {
    loadMessages();
  }, pollingIntervalMs);
}

function stopPolling() {
  if (!pollingIntervalId) {
    return;
  }

  window.clearInterval(pollingIntervalId);
  pollingIntervalId = null;
}

function scheduleReconnect() {
  if (reconnectTimeoutId) {
    return;
  }

  reconnectTimeoutId = window.setTimeout(() => {
    reconnectTimeoutId = null;
    connectWebSocket();
  }, 3000);
}

function connectWebSocket() {
  if (!getToken()) {
    return;
  }

  if (chatSocket?.connected || chatSocket?.active) {
    return;
  }

  chatSocket = window.io(socketServerUrl, {
    auth: {
      token: getToken()
    },
    autoConnect: true,
    reconnection: false
  });

  chatSocket.on("connect", () => {
    stopPolling();
  });

  chatSocket.on("message:created", (data) => {
    if (data?.payload) {
      appendMessage(data.payload);
    }
  });

  chatSocket.on("disconnect", () => {
    if (!getToken()) {
      return;
    }

    startPolling();
    scheduleReconnect();
  });

  chatSocket.on("connect_error", (error) => {
    console.error("Socket.IO connection error:", error);
    startPolling();
    scheduleReconnect();
  });
}

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const text = messageInput.value.trim();
  if (!text) return;

  try {
    const res = await fetch("/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify({ message: text })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Unable to save message");
    }

    if (!chatSocket?.connected) {
      appendMessage(data.data);
    }

    messageInput.value = "";
  } catch (error) {
    console.error("Error saving message:", error);
  }
});

logoutButton.addEventListener("click", () => {
  localStorage.removeItem("token");
  localStorage.removeItem("chatUser");

  if (reconnectTimeoutId) {
    window.clearTimeout(reconnectTimeoutId);
    reconnectTimeoutId = null;
  }

  if (chatSocket) {
    chatSocket.disconnect();
  }

  redirectToLogin();
});

window.addEventListener("DOMContentLoaded", () => {
  if (!ensureAuthenticated()) {
    return;
  }

  applyUserProfile();
  clearMessages();
  loadMessages();
  startPolling();
  connectWebSocket();
  messageInput.focus();
});
