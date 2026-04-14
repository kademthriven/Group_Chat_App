const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const chatMessages = document.getElementById("chatMessages");
const headerUserName = document.getElementById("headerUserName");
const sidebarUserPill = document.getElementById("sidebarUserPill");
const logoutButton = document.getElementById("logoutButton");
const dateDividerMarkup = `
  <div class="date-divider">
    <span>Today</span>
  </div>
`;

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

function getMessageType(messageUserId) {
  const user = getStoredUser();
  return user && Number(user.id) === Number(messageUserId) ? "sent" : "received";
}

function renderMessages(messages) {
  clearMessages();

  messages.forEach((message) => {
    const messageElement = createMessageElement({
      text: message.message,
      type: getMessageType(message.userId),
      senderName: message.sender?.name || "Unknown",
      createdAt: message.createdAt
    });

    chatMessages.appendChild(messageElement);
  });

  scrollToBottom();
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

    const messageElement = createMessageElement({
      text: data.data.message,
      type: "sent",
      senderName: data.data.sender?.name || "",
      createdAt: data.data.createdAt
    });

    chatMessages.appendChild(messageElement);
    messageInput.value = "";
  } catch (error) {
    console.error("Error saving message:", error);
  }

  scrollToBottom();
});

logoutButton.addEventListener("click", () => {
  localStorage.removeItem("token");
  localStorage.removeItem("chatUser");
  redirectToLogin();
});

window.addEventListener("DOMContentLoaded", () => {
  if (!ensureAuthenticated()) {
    return;
  }

  applyUserProfile();
  clearMessages();
  loadMessages();
  messageInput.focus();
});
