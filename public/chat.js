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
const groupCreateForm = document.getElementById("groupCreateForm");
const groupNameInput = document.getElementById("groupNameInput");
const groupJoinForm = document.getElementById("groupJoinForm");
const groupCodeInput = document.getElementById("groupCodeInput");
const dynamicGroupChats = document.getElementById("dynamicGroupChats");
const dynamicPersonalChats = document.getElementById("dynamicPersonalChats");
const mediaInput = document.getElementById("mediaInput");
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
  subtitle: "Code GENERAL - team-wide chat",
  groupId: "general-group",
  roomId: null,
  email: null
};

const groupMessagesById = new Map();
const personalMessagesByRoom = new Map();

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

function getToken() {
  return localStorage.getItem("token");
}

function redirectToLogin() {
  window.location.href = "/";
}

function ensureAuthenticated() {
  if (!getToken()) {
    redirectToLogin();
    return false;
  }

  return true;
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
  return generatePersonalRoomId(getStoredUser()?.email, targetEmail);
}

function clearMessages() {
  chatMessages.innerHTML = dateDividerMarkup;
  renderedMessageIds.clear();
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

function updateConversationHeader() {
  chatTitle.textContent = activeConversation.name;
  chatSubtitle.textContent = activeConversation.subtitle;
}

function getGroupSubtitle(group) {
  if (!group) {
    return "Group conversation";
  }

  return `Code ${group.code} - ${group.memberCount} members, ${group.onlineCount} online`;
}

function getCurrentTime() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatMessageTime(dateValue) {
  const date = dateValue ? new Date(dateValue) : new Date();

  if (Number.isNaN(date.getTime())) {
    return getCurrentTime();
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getMessageType(messageUserId) {
  const user = getStoredUser();
  return user && Number(user.id) === Number(messageUserId) ? "sent" : "received";
}

function createMessageElement({ text, type = "sent", senderName = "", createdAt }) {
  const row = document.createElement("div");
  row.className = `message-row ${type}`;

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";

  if (type === "received" && senderName) {
    const sender = document.createElement("div");
    sender.className = "message-sender";
    sender.textContent = senderName;
    bubble.appendChild(sender);
  }

  if (text) {
    const messageText = document.createElement("div");
    messageText.className = "message-text";
    messageText.textContent = text;
    bubble.appendChild(messageText);
  }

  const messageTime = document.createElement("div");
  messageTime.className = "message-time";
  messageTime.textContent = formatMessageTime(createdAt);

  bubble.appendChild(messageTime);
  row.appendChild(bubble);

  return row;
}

function appendMediaContent(bubble, media) {
  if (!media?.url) {
    return;
  }

  if (media.kind === "image") {
    const wrapper = document.createElement("div");
    wrapper.className = "message-media";

    const image = document.createElement("img");
    image.src = media.url;
    image.alt = media.fileName || "Shared image";
    wrapper.appendChild(image);
    bubble.appendChild(wrapper);
    return;
  }

  if (media.kind === "video") {
    const wrapper = document.createElement("div");
    wrapper.className = "message-media";

    const video = document.createElement("video");
    video.src = media.url;
    video.controls = true;
    video.preload = "metadata";
    wrapper.appendChild(video);
    bubble.appendChild(wrapper);
    return;
  }

  const fileLink = document.createElement("a");
  fileLink.className = "message-file";
  fileLink.href = media.url;
  fileLink.target = "_blank";
  fileLink.rel = "noopener noreferrer";
  fileLink.textContent = media.fileName || "Open file";
  bubble.appendChild(fileLink);
}

function appendMessage(message) {
  const fallbackId = `${message.userId || "user"}-${message.createdAt || Date.now()}-${message.message || ""}`;
  const messageId = String(message.id || fallbackId);

  if (renderedMessageIds.has(messageId)) {
    return;
  }

  renderedMessageIds.add(messageId);

  const messageElement = createMessageElement({
    text: message.type === "media" ? null : message.message,
    type: getMessageType(message.userId),
    senderName: message.sender?.name || "Unknown",
    createdAt: message.createdAt
  });

  const bubble = messageElement.querySelector(".message-bubble");

  if (message.type === "media" && bubble) {
    appendMediaContent(bubble, message.media);

    if (message.message) {
      const fileName = document.createElement("div");
      fileName.className = "message-text";
      fileName.textContent = message.message;
      bubble.insertBefore(fileName, bubble.querySelector(".message-time"));
    }
  }

  chatMessages.appendChild(messageElement);
  scrollToBottom();
}

function renderMessages(messages) {
  clearMessages();
  messages.forEach((message) => appendMessage(message));
}

async function apiRequest(url, options = {}) {
  const headers = {
    Authorization: `Bearer ${getToken()}`,
    ...(options.headers || {})
  };

  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

async function loadGroups() {
  const data = await apiRequest("/groups");
  return data.groups || [];
}

async function loadGroupMessages(groupId) {
  const data = await apiRequest(`/groups/${encodeURIComponent(groupId)}/messages`);
  const messages = data.messages || [];
  groupMessagesById.set(groupId, messages);
  return messages;
}

async function createGroup(name) {
  const data = await apiRequest("/groups", {
    method: "POST",
    body: JSON.stringify({ name })
  });

  return data.group;
}

async function joinGroupByCode(code) {
  const data = await apiRequest("/groups/join", {
    method: "POST",
    body: JSON.stringify({ code })
  });

  return data.group;
}

async function validatePersonalChatEmail(email) {
  const data = await apiRequest(`/user/lookup?email=${encodeURIComponent(email)}`);
  return data.user;
}

async function uploadMediaFile(file) {
  const formData = new FormData();
  formData.append("media", file);

  if (activeConversation.type === "group") {
    formData.append("conversationType", "group");
    formData.append("groupId", activeConversation.groupId);
  } else {
    formData.append("conversationType", "personal");
    formData.append("recipientEmail", activeConversation.email);
  }

  const response = await fetch("/media/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getToken()}`
    },
    body: formData
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Unable to upload media");
  }

  return data.data;
}

function createGroupChatItem(group) {
  const item = document.createElement("div");
  item.className = "chat-item";
  item.dataset.chatType = "group";
  item.dataset.chatName = group.name;
  item.dataset.chatStatus = getGroupSubtitle(group);
  item.dataset.groupId = group.id;

  item.innerHTML = `
    <div class="avatar">${group.name.charAt(0).toUpperCase()}</div>
    <div class="chat-info">
      <h6 class="mb-1">${group.name}</h6>
      <small>Group chat</small>
    </div>
    <div class="chat-meta">
      <span class="chat-badge">${group.memberCount}</span>
      <small class="text-muted">${group.onlineCount} online</small>
    </div>
  `;

  item.addEventListener("click", () => {
    activateConversation(item);
  });

  return item;
}

function updateGroupChatItem(group) {
  const existingItem = dynamicGroupChats.querySelector(`[data-group-id="${group.id}"]`);

  if (!existingItem) {
    dynamicGroupChats.appendChild(createGroupChatItem(group));
    return;
  }

  existingItem.dataset.chatName = group.name;
  existingItem.dataset.chatStatus = getGroupSubtitle(group);
  existingItem.querySelector(".chat-info h6").textContent = group.name;
  existingItem.querySelector(".chat-badge").textContent = group.memberCount;
  existingItem.querySelector(".chat-meta .text-muted").textContent = `${group.onlineCount} online`;

  if (activeConversation.type === "group" && activeConversation.groupId === group.id) {
    activeConversation.name = group.name;
    activeConversation.subtitle = existingItem.dataset.chatStatus;
    updateConversationHeader();
  }
}

function renderGroupChatItems(groups) {
  dynamicGroupChats.innerHTML = "";

  groups.forEach((group) => {
    dynamicGroupChats.appendChild(createGroupChatItem(group));
  });

  if (activeConversation.type === "group") {
    const activeItem = dynamicGroupChats.querySelector(`[data-group-id="${activeConversation.groupId}"]`);

    if (activeItem) {
      activeItem.classList.add("active");
    }
  }
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

function getChatItems() {
  return Array.from(document.querySelectorAll(".chat-item"));
}

function setActiveChatItem(nextItem) {
  getChatItems().forEach((item) => {
    item.classList.toggle("active", item === nextItem);
  });
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

function joinGroupRoom(groupId) {
  if (!chatSocket?.connected || !groupId) {
    return;
  }

  chatSocket.emit("group:join", { groupId }, (response) => {
    if (!response?.ok) {
      console.error(response?.message || "Unable to join group");
      return;
    }

    activeConversation.groupId = response.group.id;
    updateGroupChatItem(response.group);
  });
}

function leaveGroupRoom(groupId) {
  if (!chatSocket?.connected || !groupId) {
    return;
  }

  chatSocket.emit("group:leave", { groupId });
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
  });
}

function leavePersonalRoom(roomId) {
  if (!chatSocket?.connected || !roomId) {
    return;
  }

  chatSocket.emit("leave_room", { roomId });
}

async function activateConversation(item) {
  const type = item.dataset.chatType || "group";
  const nextGroupId = item.dataset.groupId || null;
  const nextRoomId = item.dataset.roomId || null;
  const nextEmail = item.dataset.email || null;

  if (activeConversation.type === "group" && activeConversation.groupId && activeConversation.groupId !== nextGroupId) {
    leaveGroupRoom(activeConversation.groupId);
  }

  if (activeConversation.type === "personal" && activeConversation.roomId && activeConversation.roomId !== nextRoomId) {
    leavePersonalRoom(activeConversation.roomId);
  }

  setActiveChatItem(item);

  activeConversation = {
    type,
    name: item.dataset.chatName || "Chat",
    subtitle: item.dataset.chatStatus || "Conversation",
    groupId: type === "group" ? nextGroupId : null,
    roomId: type === "personal" ? nextRoomId : null,
    email: type === "personal" ? nextEmail : null
  };

  updateConversationHeader();

  if (type === "group") {
    const messages = groupMessagesById.get(activeConversation.groupId) || await loadGroupMessages(activeConversation.groupId);
    renderMessages(messages);
    joinGroupRoom(activeConversation.groupId);
    return;
  }

  renderMessages(personalMessagesByRoom.get(activeConversation.roomId) || []);
  joinPersonalRoom(activeConversation.roomId, activeConversation.email);
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
    if (activeConversation.type === "group" && activeConversation.groupId) {
      joinGroupRoom(activeConversation.groupId);
      return;
    }

    if (activeConversation.type === "personal" && activeConversation.roomId && activeConversation.email) {
      joinPersonalRoom(activeConversation.roomId, activeConversation.email);
    }
  });

  chatSocket.on("group:message", (data) => {
    const message = data?.payload;

    if (!message?.groupId) {
      return;
    }

    const groupMessages = groupMessagesById.get(message.groupId) || [];
    groupMessages.push(message);
    groupMessagesById.set(message.groupId, groupMessages);

    if (activeConversation.type === "group" && activeConversation.groupId === message.groupId) {
      appendMessage(message);
    }
  });

  chatSocket.on("groups:updated", async (data) => {
    const groups = data?.groups || await loadGroups().catch(() => []);
    renderGroupChatItems(groups);
  });

  chatSocket.on("group:updated", (data) => {
    const group = data?.group;

    if (!group?.id) {
      return;
    }

    updateGroupChatItem(group);
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

    scheduleReconnect();
  });

  chatSocket.on("connect_error", (error) => {
    console.error("Socket.IO connection error:", error);
    scheduleReconnect();
  });
}

async function initializeGroupView() {
  const groups = await loadGroups();
  renderGroupChatItems(groups);

  const generalMessages = await loadGroupMessages("general-group");
  renderMessages(generalMessages);

  const generalItem = dynamicGroupChats.querySelector('[data-group-id="general-group"]');

  if (generalItem) {
    setActiveChatItem(generalItem);
  }
}

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const text = messageInput.value.trim();

  if (!text) {
    return;
  }

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

  chatSocket.emit("group:message:create", {
    groupId: activeConversation.groupId,
    message: text
  }, (response) => {
    if (!response?.ok) {
      console.error(response?.message || "Unable to send group message");
      return;
    }

    const groupMessages = groupMessagesById.get(activeConversation.groupId) || [];
    groupMessages.push(response.data);
    groupMessagesById.set(activeConversation.groupId, groupMessages);
    appendMessage(response.data);
    messageInput.value = "";
  });
});

groupCreateForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = groupNameInput.value.trim();

  if (!name) {
    return;
  }

  try {
    const group = await createGroup(name);
    const groups = await loadGroups();
    renderGroupChatItems(groups);
    groupNameInput.value = "";
    groupCodeInput.value = group.code;
    window.alert(`Group created successfully. Share this group code to join: ${group.code}`);

    const createdItem = dynamicGroupChats.querySelector(`[data-group-id="${group.id}"]`);

    if (createdItem) {
      await activateConversation(createdItem);
    }
  } catch (error) {
    console.error(error.message);
  }
});

groupJoinForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const code = groupCodeInput.value.trim();

  if (!code) {
    return;
  }

  try {
    const group = await joinGroupByCode(code);
    const groups = await loadGroups();
    renderGroupChatItems(groups);
    groupCodeInput.value = "";

    const joinedItem = dynamicGroupChats.querySelector(`[data-group-id="${group.id}"]`);

    if (joinedItem) {
      await activateConversation(joinedItem);
    }
  } catch (error) {
    console.error(error.message);
  }
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
    await activateConversation(personalItem);
    roomEmailInput.value = "";
  } catch (error) {
    console.error(error.message);
  }
});

mediaInput.addEventListener("change", async (event) => {
  const [file] = event.target.files || [];

  if (!file) {
    return;
  }

  try {
    const mediaMessage = await uploadMediaFile(file);

    if (activeConversation.type === "group") {
      const groupMessages = groupMessagesById.get(activeConversation.groupId) || [];
      groupMessages.push(mediaMessage);
      groupMessagesById.set(activeConversation.groupId, groupMessages);
    } else {
      const roomMessages = personalMessagesByRoom.get(activeConversation.roomId) || [];
      roomMessages.push(mediaMessage);
      personalMessagesByRoom.set(activeConversation.roomId, roomMessages);
    }

    appendMessage(mediaMessage);
  } catch (error) {
    console.error(error.message);
  } finally {
    mediaInput.value = "";
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

window.addEventListener("DOMContentLoaded", async () => {
  if (!ensureAuthenticated()) {
    return;
  }

  applyUserProfile();
  updateConversationHeader();
  clearMessages();
  connectWebSocket();

  try {
    await initializeGroupView();
  } catch (error) {
    console.error("Unable to initialize group chats:", error);
  }

  messageInput.focus();
});
