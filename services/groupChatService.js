const fs = require("fs");
const path = require("path");

function createId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeGroupName(name = "") {
  return name.trim();
}

function serializeGroup(group) {
  return {
    id: group.id,
    code: group.code,
    name: group.name,
    createdAt: group.createdAt,
    memberCount: group.members.size,
    onlineCount: group.onlineUsers.size
  };
}

function createGroupChatService() {
  const groups = new Map();
  const socketGroups = new Map();
  const dataDirectory = path.join(__dirname, "..", "data");
  const storageFile = path.join(dataDirectory, "groups.json");

  function persistGroups() {
    fs.mkdirSync(dataDirectory, {
      recursive: true
    });

    const payload = Array.from(groups.values()).map((group) => ({
      id: group.id,
      code: group.code,
      name: group.name,
      createdAt: group.createdAt,
      members: Array.from(group.members.values()),
      messages: group.messages
    }));

    fs.writeFileSync(storageFile, JSON.stringify(payload, null, 2), "utf8");
  }

  function loadPersistedGroups() {
    if (!fs.existsSync(storageFile)) {
      return;
    }

    try {
      const raw = fs.readFileSync(storageFile, "utf8");

      if (!raw.trim()) {
        return;
      }

      const parsedGroups = JSON.parse(raw);

      parsedGroups.forEach((group) => {
        groups.set(group.id, {
          id: group.id,
          code: group.code,
          name: group.name,
          createdAt: group.createdAt,
          members: new Map((group.members || []).map((member) => [String(member.id), member])),
          onlineUsers: new Map(),
          messages: group.messages || []
        });
      });
    } catch (error) {
      console.error("Unable to load persisted groups:", error);
    }
  }

  function createSeedGroup() {
    if (!groups.has("general-group")) {
      const generalGroup = {
        id: "general-group",
        code: "GENERAL",
        name: "General Group",
        createdAt: new Date().toISOString(),
        members: new Map(),
        onlineUsers: new Map(),
        messages: []
      };

      groups.set(generalGroup.id, generalGroup);
      persistGroups();
    }
  }

  function getGroupById(groupId) {
    return groups.get(groupId) || null;
  }

  function getGroupByCode(code = "") {
    const normalizedCode = code.trim().toUpperCase();

    for (const group of groups.values()) {
      if (group.code === normalizedCode) {
        return group;
      }
    }

    return null;
  }

  function ensureMembership(group, user) {
    if (!group || !user?.id) {
      return group;
    }

    group.members.set(String(user.id), {
      id: user.id,
      name: user.name,
      email: user.email
    });

    return group;
  }

  function trackSocketInGroup(group, user, socketId) {
    if (!group || !user?.id || !socketId) {
      return group;
    }

    const userKey = String(user.id);
    const connectedSockets = group.onlineUsers.get(userKey) || new Set();
    connectedSockets.add(socketId);
    group.onlineUsers.set(userKey, connectedSockets);

    const joinedGroups = socketGroups.get(socketId) || new Set();
    joinedGroups.add(group.id);
    socketGroups.set(socketId, joinedGroups);

    return group;
  }

  function untrackSocketFromGroup(group, socketId) {
    if (!group || !socketId) {
      return false;
    }

    let changed = false;

    for (const [userId, connectedSockets] of group.onlineUsers.entries()) {
      if (connectedSockets.delete(socketId)) {
        changed = true;
      }

      if (connectedSockets.size === 0) {
        group.onlineUsers.delete(userId);
      }
    }

    return changed;
  }

  loadPersistedGroups();
  createSeedGroup();

  return {
    listGroups() {
      return Array.from(groups.values()).map(serializeGroup);
    },

    listGroupsForUser(userId) {
      const userKey = String(userId || "");

      return Array.from(groups.values())
        .filter((group) => group.id === "general-group" || group.members.has(userKey))
        .map(serializeGroup);
    },

    createGroup({ name, user }) {
      const normalizedName = normalizeGroupName(name);

      if (!normalizedName) {
        throw new Error("Group name is required");
      }

      const group = {
        id: createId("group"),
        code: Math.random().toString(36).slice(2, 8).toUpperCase(),
        name: normalizedName,
        createdAt: new Date().toISOString(),
        members: new Map(),
        onlineUsers: new Map(),
        messages: []
      };

      ensureMembership(group, user);
      groups.set(group.id, group);
      persistGroups();

      return serializeGroup(group);
    },

    joinGroup({ groupId, code, user, socketId }) {
      const group = groupId ? getGroupById(groupId) : getGroupByCode(code);

      if (!group) {
        throw new Error("Group not found");
      }

      ensureMembership(group, user);
      trackSocketInGroup(group, user, socketId);
      persistGroups();
      return serializeGroup(group);
    },

    leaveGroup({ groupId, socketId, userId }) {
      const group = getGroupById(groupId);

      if (!group) {
        throw new Error("Group not found");
      }

      if (group.id !== "general-group" && userId) {
        group.members.delete(String(userId));
      }

      untrackSocketFromGroup(group, socketId);

      const joinedGroups = socketGroups.get(socketId);
      if (joinedGroups) {
        joinedGroups.delete(group.id);

        if (joinedGroups.size === 0) {
          socketGroups.delete(socketId);
        }
      }

      if (group.id !== "general-group") {
        persistGroups();
      }

      return serializeGroup(group);
    },

    disconnectSocket(socketId) {
      const joinedGroups = socketGroups.get(socketId);

      if (!joinedGroups) {
        return [];
      }

      const updatedGroups = [];

      joinedGroups.forEach((groupId) => {
        const group = getGroupById(groupId);

        if (!group) {
          return;
        }

        if (untrackSocketFromGroup(group, socketId)) {
          updatedGroups.push(serializeGroup(group));
        }
      });

      socketGroups.delete(socketId);
      return updatedGroups;
    },

    getGroupMessages(groupId) {
      const group = getGroupById(groupId);

      if (!group) {
        throw new Error("Group not found");
      }

      return group.messages.slice();
    },

    addMessage({ groupId, user, message }) {
      const group = getGroupById(groupId);
      const trimmedMessage = message?.trim();

      if (!group) {
        throw new Error("Group not found");
      }

      if (!trimmedMessage) {
        throw new Error("Message is required");
      }

      ensureMembership(group, user);

      const groupMessage = {
        id: createId("msg"),
        groupId: group.id,
        message: trimmedMessage,
        userId: user.id,
        sender: {
          id: user.id,
          name: user.name,
          email: user.email
        },
        createdAt: new Date().toISOString()
      };

      group.messages.push(groupMessage);
      persistGroups();
      return groupMessage;
    },

    appendExistingMessage({ groupId, message }) {
      const group = getGroupById(groupId);

      if (!group) {
        throw new Error("Group not found");
      }

      group.messages.push(message);
      persistGroups();
      return message;
    },

    hasGroup(groupId) {
      return Boolean(getGroupById(groupId));
    }
  };
}

module.exports = createGroupChatService;
