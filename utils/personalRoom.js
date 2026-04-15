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

module.exports = {
  normalizeEmail,
  generatePersonalRoomId
};
