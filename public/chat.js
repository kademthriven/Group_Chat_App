const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const chatMessages = document.getElementById("chatMessages");
const headerUserName = document.getElementById("headerUserName");
const sidebarUserPill = document.getElementById("sidebarUserPill");
const logoutButton = document.getElementById("logoutButton");
const chatTitle = document.getElementById("chatTitle");
const chatSubtitle = document.getElementById("chatSubtitle");
const personalChatForm = document.getElementById("personalChatForm");
const roomEmailInput = document.getElementById("roomEmailInput");
const dynamicPersonalChats = document.getElementById("dynamicPersonalChats");
const renderedMessageIds = new Set();
const socketServerUrl = window.location.origin;
const dateDividerMarkup = `
  <div class="date-divider">
    <span>Today</span>
  </div>
`;
let chatSocket;
let reconnectTimeoutId;
let activeConversation = {
  type: "group",
  name: "General Group",
  subtitle: "12 members online",
  roomId: null,
  email: null
};
const personalMessagesByRoom = new Map();
const baseChatItems = Array.from(document.querySelectorAll(".chat-item"));

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

function normalizeEmail(email = "") {
  return email.trim().toLowerCase();
}

function generatePersonalRoomId(firstEmail, secondEmail) {
  const participants = [normalizeEmail(firstEmail), normalizeEmail(secondEmail)]
    .filter(Boolean)
    .sort();

  if (participants.length !== 2 || participants[0] === participants[1]) {
    return null;
  }

  return participants.join("::");
}

function getPersonalRoomKey(targetEmail) {
  const currentUser = getStoredUser();
  return generatePersonalRoomId(currentUser?.email, targetEmail);
}

async function validatePersonalChatEmail(email) {
  const response = await fetch(`/user/lookup?email=${encodeURIComponent(email)}`, {
    headers: {
      Authorization: `Bearer ${getToken()}`
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Unable to verify the email address");
  }

  return data.user;
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
  const fallbackId = `${message.userId || "user"}-${message.createdAt || Date.now()}-${message.message || ""}`;
  const messageId = String(message.id || fallbackId);

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

function renderPersonalMessages(room) {
  clearMessages();

  (personalMessagesByRoom.get(room) || []).forEach((message) => {
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
    if (activeConversation.roomId && activeConversation.email) {
      joinPersonalRoom(activeConversation.roomId, activeConversation.email);
    }
  });

  chatSocket.on("message:created", (data) => {
    if (data?.payload && activeConversation.type === "group") {
      appendMessage(data.payload);
    }
  });

  chatSocket.on("new_message", (data) => {
    const message = data?.payload;

    if (!message?.roomId) {
      return;
    }

    const roomMessages = personalMessagesByRoom.get(message.roomId) || [];
    roomMessages.push(message);
    personalMessagesByRoom.set(message.roomId, roomMessages);

    if (activeConversation.type === "personal" && activeConversation.roomId === message.roomId) {
      appendMessage(message);
    }
  });

  chatSocket.on("disconnect", () => {
    if (!getToken()) {
      return;
    }

    if (activeConversation.type === "group") {
      loadMessages();
    }

    scheduleReconnect();
  });

  chatSocket.on("connect_error", (error) => {
    console.error("Socket.IO connection error:", error);
    scheduleReconnect();
  });
}

function updateConversationHeader() {
  chatTitle.textContent = activeConversation.name;
  chatSubtitle.textContent = activeConversation.subtitle;
}

function getChatItems() {
  return Array.from(document.querySelectorAll(".chat-item"));
}

function setActiveChatItem(nextItem) {
  getChatItems().forEach((item) => {
    item.classList.toggle("active", item === nextItem);
  });
}

function createPersonalChatItem(email) {
  const item = document.createElement("div");
  item.className = "chat-item";
  item.dataset.chatType = "personal";
  item.dataset.chatName = email;
  item.dataset.chatStatus = `Direct conversation with ${email}`;
  item.dataset.roomId = getPersonalRoomKey(email);
  item.dataset.email = email;

  item.innerHTML = `
    <div class="avatar alt">${email.charAt(0).toUpperCase()}</div>
    <div class="chat-info">
      <h6 class="mb-1">${email}</h6>
      <small>Direct messages</small>
    </div>
  `;

  item.addEventListener("click", () => {
    activateConversation(item);
  });

  return item;
}

function ensurePersonalChatItem(email) {
  const normalizedEmail = normalizeEmail(email);
  const existingItem = dynamicPersonalChats.querySelector(`[data-email="${normalizedEmail}"]`);

  if (existingItem) {
    return existingItem;
  }

  const nextItem = createPersonalChatItem(normalizedEmail);
  dynamicPersonalChats.prepend(nextItem);
  return nextItem;
}

function joinPersonalRoom(roomId, targetEmail) {
  if (!chatSocket?.connected || !roomId || !targetEmail) {
    return;
  }

  chatSocket.emit("join_room", { roomId, targetEmail }, (response) => {
    if (!response?.ok) {
      console.error(response?.message || "Unable to join personal room");
      return;
    }

    activeConversation.roomId = response.roomId;
    activeConversation.email = response.recipient?.email || targetEmail;
    renderPersonalMessages(response.roomId);
  });
}

function leavePersonalRoom(roomId) {
  if (!chatSocket?.connected || !roomId) {
    return;
  }

  chatSocket.emit("leave_room", { roomId });
}

function activateConversation(item) {
  const type = item.dataset.chatType || "group";
  const name = item.dataset.chatName || "Chat";
  const nextRoomId = item.dataset.roomId || null;
  const nextEmail = item.dataset.email || null;

  if (activeConversation.type === "personal" && activeConversation.roomId && activeConversation.roomId !== nextRoomId) {
    leavePersonalRoom(activeConversation.roomId);
  }

  setActiveChatItem(item);
  activeConversation = {
    type,
    name,
    subtitle: item.dataset.chatStatus || (type === "group" ? "12 members online" : "Direct messages"),
    roomId: type === "personal" ? nextRoomId : null,
    email: type === "personal" ? nextEmail : null
  };

  updateConversationHeader();

  if (type === "group") {
    loadMessages();
    return;
  }

  clearMessages();
  renderPersonalMessages(activeConversation.roomId);
  joinPersonalRoom(activeConversation.roomId, activeConversation.email);
}

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const text = messageInput.value.trim();
  if (!text) return;

  if (activeConversation.type === "personal") {
    if (!chatSocket?.connected || !activeConversation.roomId) {
      console.error("Socket is not connected for personal messaging");
      return;
    }

    chatSocket.emit("new_message", {
      roomId: activeConversation.roomId,
      recipientEmail: activeConversation.email,
      message: text
    }, (response) => {
      if (!response?.ok) {
        console.error(response?.message || "Unable to send personal message");
        return;
      }

      const roomMessages = personalMessagesByRoom.get(activeConversation.roomId) || [];
      roomMessages.push(response.data);
      personalMessagesByRoom.set(activeConversation.roomId, roomMessages);
      appendMessage(response.data);
      messageInput.value = "";
    });

    return;
  }

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
  updateConversationHeader();
  clearMessages();
  loadMessages();
  connectWebSocket();
  baseChatItems.forEach((item) => {
    item.addEventListener("click", () => {
      activateConversation(item);
    });
  });
  personalChatForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = normalizeEmail(roomEmailInput.value);
    const currentUser = getStoredUser();

    if (!email || !currentUser?.email) {
      return;
    }

    if (email === normalizeEmail(currentUser.email)) {
      console.error("You cannot create a personal room with your own email");
      return;
    }

    try {
      const existingUser = await validatePersonalChatEmail(email);
      const personalItem = ensurePersonalChatItem(existingUser.email);
      activateConversation(personalItem);
      roomEmailInput.value = "";
    } catch (error) {
      console.error(error.message);
    }
  });
  messageInput.focus();
});
