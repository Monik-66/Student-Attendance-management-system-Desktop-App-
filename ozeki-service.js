function getOzekiConfig() {
  const apiUrl = String(process.env.OZEKI_API_URL || "http://127.0.0.1:9509/api").trim();
  const username = String(process.env.OZEKI_USERNAME || "").trim();
  const password = String(process.env.OZEKI_PASSWORD || "").trim();
  const originator = String(process.env.OZEKI_ORIGINATOR || "").trim();
  const defaultCountryCode = String(process.env.OZEKI_DEFAULT_COUNTRY_CODE || "+91").trim();

  return {
    configured: Boolean(apiUrl && username && password),
    apiUrl,
    username,
    password,
    originator,
    defaultCountryCode
  };
}

function normalizePhoneNumber(phoneNumber, defaultCountryCode) {
  const digitsAndPlus = String(phoneNumber || "").replace(/[^\d+]/g, "");

  if (!digitsAndPlus) {
    return "";
  }

  if (digitsAndPlus.startsWith("+")) {
    return digitsAndPlus;
  }

  if (/^\d{10}$/.test(digitsAndPlus)) {
    return `${defaultCountryCode}${digitsAndPlus}`;
  }

  return `+${digitsAndPlus}`;
}

function buildSmsBody({ studentName, subjectName }) {
  const universityName = String(process.env.UNIVERSITY_NAME || "SAPTHAGIRI NPS UNIVERSITY").trim();
  const timeLabel = new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: process.env.TZ || "Asia/Calcutta"
  }).format(new Date());

  return `${universityName}: Your ward, ${studentName}, was absent from the ${subjectName} class today at ${timeLabel}. Please contact the department for any clarifications.`;
}

function buildAuthorizationHeader(username, password) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

function buildMessagePayload(config, to, body) {
  const message = {
    ToAddress: to,
    Text: body
  };

  if (config.originator) {
    message.FromAddress = config.originator;
  }

  return message;
}

async function tryOzekiRestRequest(config, body) {
  const response = await fetch(config.apiUrl, {
    method: "POST",
    headers: {
      Authorization: buildAuthorizationHeader(config.username, config.password),
      "Content-Type": "application/json",
      Accept: "application/json,text/plain,text/xml,application/xml"
    },
    body: JSON.stringify(body)
  });

  const responseText = await response.text();

  return {
    ok: response.ok,
    status: response.status,
    responseText
  };
}

async function sendSingleSms(config, absentee, subjectName) {
  const to = normalizePhoneNumber(absentee.parentPhoneNo, config.defaultCountryCode);

  if (!to) {
    return {
      srn: absentee.srn,
      name: absentee.name,
      to: "",
      ok: false,
      providerId: null,
      error: "Parent phone number is missing."
    };
  }

  const body = buildSmsBody({
    studentName: absentee.name,
    subjectName
  });

  try {
    const messagePayload = buildMessagePayload(config, to, body);
    const attempts = [
      messagePayload,
      { Message: messagePayload },
      { message: messagePayload },
      { Messages: [messagePayload] },
      { messages: [messagePayload] }
    ];

    let finalAttempt = null;

    for (const attemptBody of attempts) {
      const attemptResult = await tryOzekiRestRequest(config, attemptBody);
      finalAttempt = attemptResult;

      if (attemptResult.ok) {
        return {
          srn: absentee.srn,
          name: absentee.name,
          to,
          ok: true,
          providerId: attemptResult.responseText || "accepted",
          error: null
        };
      }
    }

    if (!finalAttempt?.ok) {
      return {
        srn: absentee.srn,
        name: absentee.name,
        to,
        ok: false,
        providerId: null,
        error: finalAttempt?.responseText || `Ozeki request failed with status ${finalAttempt?.status || "unknown"}.`
      };
    }
  } catch (error) {
    return {
      srn: absentee.srn,
      name: absentee.name,
      to,
      ok: false,
      providerId: null,
      error: error.message
    };
  }
}

async function sendAbsenteeSms({ absentees, subjectName }) {
  const config = getOzekiConfig();

  if (!config.configured) {
    throw new Error(
      "Ozeki is not configured. Add OZEKI_API_URL, OZEKI_USERNAME, and OZEKI_PASSWORD to .env."
    );
  }

  const results = [];

  for (const absentee of absentees || []) {
    results.push(await sendSingleSms(config, absentee, subjectName));
  }

  return {
    ok: true,
    sentCount: results.filter((entry) => entry.ok).length,
    failedCount: results.filter((entry) => !entry.ok).length,
    results
  };
}

module.exports = {
  getOzekiConfig,
  normalizePhoneNumber,
  sendAbsenteeSms
};
