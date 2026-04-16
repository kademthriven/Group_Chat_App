const https = require("https");

function normalizeText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function sanitizeSuggestionList(items, maxItems = 3) {
  const seen = new Set();

  return (Array.isArray(items) ? items : [])
    .map((item) => normalizeText(item))
    .filter((item) => {
      if (!item || item.length > 80) {
        return false;
      }

      const key = item.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, maxItems);
}

function buildStyleProfile(recentMessages = [], currentUser = {}) {
  const sentMessages = recentMessages
    .filter((message) => Number(message.userId) === Number(currentUser.id))
    .map((message) => normalizeText(message.message))
    .filter(Boolean)
    .slice(-12);

  const joined = sentMessages.join(" ");
  const emojiMatches = joined.match(/[\u{1F300}-\u{1FAFF}]/gu) || [];
  const emojiCount = emojiMatches.length;
  const exclamationCount = (joined.match(/!/g) || []).length;
  const lowercaseStarts = sentMessages.filter((message) => /^[a-z]/.test(message)).length;
  const emojiFrequency = emojiMatches.reduce((accumulator, emoji) => {
    accumulator[emoji] = (accumulator[emoji] || 0) + 1;
    return accumulator;
  }, {});
  const preferredEmojis = Object.entries(emojiFrequency)
    .sort((first, second) => second[1] - first[1])
    .slice(0, 3)
    .map(([emoji]) => emoji);

  return {
    tone: exclamationCount >= 4 || lowercaseStarts >= 4 ? "casual" : "neutral",
    emojiStyle: emojiCount >= 2 ? "uses emojis sometimes" : "minimal emojis",
    preferredEmojis
  };
}

function withPreferredEmoji(text, styleProfile = {}) {
  const normalized = normalizeText(text);

  if (!normalized || styleProfile.emojiStyle !== "uses emojis sometimes") {
    return normalized;
  }

  if (/[\u{1F300}-\u{1FAFF}]/u.test(normalized)) {
    return normalized;
  }

  const emoji = styleProfile.preferredEmojis?.[0] || "??";
  return `${normalized} ${emoji}`;
}

function collectContextTerms(recentMessages = []) {
  const text = recentMessages
    .map((message) => normalizeText(message.message || ""))
    .join(" ");
  const lowered = text.toLowerCase();

  const places = [];
  const times = [];

  [
    "office",
    "meeting room",
    "cafeteria",
    "lobby",
    "entrance",
    "home",
    "online"
  ].forEach((term) => {
    if (lowered.includes(term)) {
      places.push(term);
    }
  });

  [
    "today",
    "tomorrow",
    "tonight",
    "this evening",
    "this afternoon",
    "5 pm",
    "6 pm",
    "in 5 minutes"
  ].forEach((term) => {
    if (lowered.includes(term)) {
      times.push(term);
    }
  });

  return {
    places,
    times
  };
}

function fallbackPredictiveTyping(draft = "", recentMessages = [], styleProfile = {}) {
  const normalizedDraft = normalizeText(draft);
  const loweredDraft = normalizedDraft.toLowerCase();
  const context = collectContextTerms(recentMessages);
  const lastWord = loweredDraft.split(" ").filter(Boolean).pop() || "";

  if (!normalizedDraft) {
    return [];
  }

  const contextualPlace = context.places[0] || "the office";
  const contextualTime = context.times[0] || "tomorrow";

  if (/^(hi|hii|hey|hello)$/.test(loweredDraft)) {
    return [
      withPreferredEmoji("hi", styleProfile),
      withPreferredEmoji("hey there", styleProfile),
      withPreferredEmoji("hello", styleProfile)
    ];
  }

  if (/^(good morning|good afternoon|good evening)$/.test(loweredDraft)) {
    return [
      withPreferredEmoji("good morning", styleProfile),
      withPreferredEmoji("hope you are doing well", styleProfile),
      withPreferredEmoji("have a nice day", styleProfile)
    ];
  }

  if (/(let'?s|lets)\s+meet$/.test(loweredDraft)) {
    return ["at 5 pm", `at ${contextualPlace}`, contextualTime];
  }

  if (/(let'?s|lets)\s+meet\s+at$/.test(loweredDraft)) {
    return ["5 pm", contextualPlace, contextualTime];
  }

  if (/(where\s+should\s+we\s+meet|meet\s+where)$/.test(loweredDraft)) {
    return [contextualPlace, "the lobby", "online"];
  }

  if (/(when\s+should\s+we\s+meet|meet\s+when)$/.test(loweredDraft)) {
    return ["tomorrow morning", "5 pm", "after lunch"];
  }

  if (/(i\s+am|i'm)$/.test(loweredDraft)) {
    return [
      withPreferredEmoji("on my way", styleProfile),
      "running a little late",
      "almost there"
    ];
  }

  if (/(i\s+will|i'll)$/.test(loweredDraft)) {
    return ["join in 5 minutes", "send it shortly", "update you soon"];
  }

  if (/(can\s+you|could\s+you|please)$/.test(loweredDraft)) {
    return ["share the details", "send the file", "join the call"];
  }

  if (/(thanks|thank\s+you)$/.test(loweredDraft)) {
    return [
      withPreferredEmoji("for the update", styleProfile),
      "for helping",
      "so much"
    ];
  }

  if (/(see\s+you)$/.test(loweredDraft)) {
    return [
      withPreferredEmoji("soon", styleProfile),
      "tomorrow",
      `at ${contextualPlace}`
    ];
  }

  if (/(on\s+my)$/.test(loweredDraft)) {
    return ["way", "screen now", "side in 5 minutes"];
  }

  if (/(running)$/.test(lastWord)) {
    return ["late", "a bit behind", "into a delay"];
  }

  if (/(tom|tomo|tomor)$/.test(lastWord)) {
    return ["tomorrow", "tomorrow morning", "tomorrow evening"];
  }

  if (/(meet|call|join|come|send|share|finish|start|check|update)$/.test(lastWord)) {
    const actionMap = {
      meet: ["at 5 pm", `at ${contextualPlace}`, contextualTime],
      call: ["you in 5 minutes", "after lunch", "once I am free"],
      join: ["the meeting now", "in 5 minutes", "from my laptop"],
      come: ["to the office", "by 5 pm", "tomorrow morning"],
      send: ["the file now", "the details shortly", "an update soon"],
      share: ["the link here", "the details please", "the file with me"],
      finish: ["this today", "it by evening", "the task soon"],
      start: ["now", "after lunch", "once we align"],
      check: ["this once", "and confirm", "the latest update"],
      update: ["you soon", "the team now", "the status here"]
    };

    return actionMap[lastWord] || [];
  }

  if (loweredDraft.includes("?")) {
    return ["when you can", "if that works", "and let me know"];
  }

  return [
    withPreferredEmoji("in a few minutes", styleProfile),
    `at ${contextualPlace}`,
    "and let me know"
  ];
}

function fallbackSmartReplies(lastIncomingMessage = "", styleProfile = {}) {
  const text = normalizeText(lastIncomingMessage).toLowerCase();
  const emojiSuffix = styleProfile.emojiStyle === "uses emojis sometimes"
    ? ` ${styleProfile.preferredEmojis?.[0] || "??"}`
    : "";

  if (!text) {
    return [];
  }

  if (/^(hi|hii|hey|hello)\b/.test(text)) {
    return [
      withPreferredEmoji("Hi", styleProfile),
      withPreferredEmoji("Hey, how are you?", styleProfile),
      withPreferredEmoji("Hello", styleProfile)
    ];
  }

  if (text.includes("are you coming") || text.includes("can you join")) {
    return [
      `Yes, I will be there${emojiSuffix}`,
      "Running a little late, joining soon",
      "I cannot make it, can we reschedule?"
    ];
  }

  if (text.includes("where") || text.includes("location")) {
    return [
      withPreferredEmoji("I am on my way", styleProfile),
      "At the office entrance",
      "Share the exact location please"
    ];
  }

  if (text.includes("when") || text.includes("what time")) {
    return [
      "I can do 5 pm",
      "Tomorrow morning works for me",
      "I will confirm in a bit"
    ];
  }

  if (text.includes("thanks") || text.includes("thank you")) {
    return [withPreferredEmoji("Happy to help", styleProfile), "Anytime", "You are welcome"];
  }

  if (text.includes("?")) {
    return [
      `Yes, that works for me${emojiSuffix}`,
      "I will check and get back to you",
      "Can you share a bit more detail?"
    ];
  }

  return [
    withPreferredEmoji("Sounds good", styleProfile),
    "I am on it",
    "Will update you shortly"
  ];
}

function extractTextParts(responseBody) {
  const candidates = responseBody?.candidates || [];
  const first = candidates[0];
  const parts = first?.content?.parts || [];

  return parts
    .map((part) => part?.text || "")
    .join("")
    .trim();
}

function postJson(url, payload, headers = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const request = https.request(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        ...headers
      }
    }, (response) => {
      let data = "";

      response.on("data", (chunk) => {
        data += chunk;
      });

      response.on("end", () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`Gemini request failed with status ${response.statusCode}`));
          return;
        }

        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(new Error("Unable to parse Gemini response"));
        }
      });
    });

    request.on("error", reject);
    request.write(body);
    request.end();
  });
}

async function generateGeminiSuggestions({
  draft,
  recentMessages,
  currentUser,
  conversationType,
  conversationName
}) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing Gemini API key");
  }

  const styleProfile = buildStyleProfile(recentMessages, currentUser);
  const contextMessages = recentMessages.slice(-8).map((message) => ({
    senderName: message.sender?.name || "Unknown",
    direction: Number(message.userId) === Number(currentUser.id) ? "sent" : "received",
    text: normalizeText(message.message || message.media?.fileName || "")
  }));

  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: [
              "You are an assistant for a chat app.",
              "Generate concise, relevant, safe chat suggestions.",
              "Return JSON only with keys predictiveSuggestions and smartReplies.",
              "Each list must contain 2 to 3 short suggestions.",
              "Predictive suggestions should continue the user's current draft, not repeat it.",
              "Predictive suggestions must closely match the exact words already typed.",
              "If the draft is empty, predictiveSuggestions must be an empty array.",
              "If the draft is a greeting like hi, hey, or hello, include greeting completions and a light emoji when it fits the user's style.",
              "Smart replies should answer the latest received message in context.",
              "Keep each suggestion under 12 words and avoid harmful, explicit, or rude content.",
              `Conversation type: ${conversationType || "group"}`,
              `Conversation name: ${conversationName || "Chat"}`,
              `User style: ${styleProfile.tone}, ${styleProfile.emojiStyle}`,
              `Preferred emojis: ${(styleProfile.preferredEmojis || []).join(" ") || "none"}`,
              `Current draft: "${normalizeText(draft)}"`,
              `Recent messages: ${JSON.stringify(contextMessages)}`
            ].join("\n")
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 220,
      responseMimeType: "application/json"
    }
  };

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await postJson(url, payload);
  const rawText = extractTextParts(response) || "{}";
  const parsed = JSON.parse(rawText);

  return {
    predictiveSuggestions: sanitizeSuggestionList(parsed.predictiveSuggestions, 3),
    smartReplies: sanitizeSuggestionList(parsed.smartReplies, 3)
  };
}

async function getChatSuggestions({
  draft,
  recentMessages = [],
  currentUser = {},
  conversationType,
  conversationName
}) {
  const normalizedDraft = normalizeText(draft);
  const styleProfile = buildStyleProfile(recentMessages, currentUser);
  const lastIncomingMessage = [...recentMessages]
    .reverse()
    .find((message) => Number(message.userId) !== Number(currentUser.id) && normalizeText(message.message));

  const fallback = {
    predictiveSuggestions: sanitizeSuggestionList(
      fallbackPredictiveTyping(normalizedDraft, recentMessages, styleProfile),
      3
    ),
    smartReplies: sanitizeSuggestionList(
      fallbackSmartReplies(lastIncomingMessage?.message, styleProfile),
      3
    ),
    source: "fallback"
  };

  try {
    const generated = await generateGeminiSuggestions({
      draft: normalizedDraft,
      recentMessages,
      currentUser,
      conversationType,
      conversationName
    });

    return {
      predictiveSuggestions: generated.predictiveSuggestions.length
        ? generated.predictiveSuggestions
        : fallback.predictiveSuggestions,
      smartReplies: generated.smartReplies.length
        ? generated.smartReplies
        : fallback.smartReplies,
      source: "gemini"
    };
  } catch (error) {
    return fallback;
  }
}

module.exports = {
  getChatSuggestions
};
