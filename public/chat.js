const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const chatMessages = document.getElementById("chatMessages");

function getCurrentTime() {
  const now = new Date();
  return now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function createMessageElement(text, type = "sent") {
  const row = document.createElement("div");
  row.className = `message-row ${type}`;

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";

  const messageText = document.createElement("div");
  messageText.className = "message-text";
  messageText.textContent = text;

  const messageTime = document.createElement("div");
  messageTime.className = "message-time";
  messageTime.textContent = getCurrentTime();

  bubble.appendChild(messageText);
  bubble.appendChild(messageTime);
  row.appendChild(bubble);

  return row;
}

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const text = messageInput.value.trim();
  if (!text) return;

  const messageElement = createMessageElement(text, "sent");
  chatMessages.appendChild(messageElement);

  messageInput.value = "";
  scrollToBottom();
});

window.addEventListener("DOMContentLoaded", scrollToBottom);