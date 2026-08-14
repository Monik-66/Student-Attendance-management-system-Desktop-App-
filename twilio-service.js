const twilio = require("twilio");

function getTwilioConfig() {
  const accountSid = String(process.env.TWILIO_ACCOUNT_SID || "").trim();
  const authToken = String(process.env.TWILIO_AUTH_TOKEN || "").trim();
  const fromNumber = String(process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER || "").trim();
  const messagingServiceSid = String(process.env.TWILIO_MESSAGING_SERVICE_SID || "").trim();
  const defaultCountryCode = String(process.env.TWILIO_DEFAULT_COUNTRY_CODE || "+91").trim();

  const configured = Boolean(accountSid && authToken && (fromNumber || messagingServiceSid));

  return {
    configured,
    accountSid,
    authToken,
    fromNumber,
    messagingServiceSid,
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

function buildSmsBody({ studentName, srn, sectionCode, attendanceDate, subjectName }) {
  const universityName = String(process.env.UNIVERSITY_NAME || "SAPTHAGIRI NPS UNIVERSITY").trim();
  const timeLabel = new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: process.env.TZ || "Asia/Calcutta"
  }).format(new Date());

  return `${universityName}: Your ward, ${studentName}, was absent from the ${subjectName} class today at ${timeLabel}. Please contact the department for any clarifications.`;
}

async function sendAbsenteeSms({ absentees, sectionCode, attendanceDate, subjectName }) {
  const config = getTwilioConfig();

  if (!config.configured) {
    throw new Error(
      "Twilio is not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and either TWILIO_PHONE_NUMBER, TWILIO_FROM_NUMBER, or TWILIO_MESSAGING_SERVICE_SID to .env."
    );
  }

  const client = twilio(config.accountSid, config.authToken);
  const results = [];

  for (const absentee of absentees || []) {
    const to = normalizePhoneNumber(absentee.parentPhoneNo, config.defaultCountryCode);

    if (!to) {
      results.push({
        srn: absentee.srn,
        name: absentee.name,
        to: "",
        ok: false,
        messageSid: null,
        error: "Parent phone number is missing."
      });
      continue;
    }

    try {
      const messagePayload = {
        to,
        body: buildSmsBody({
          studentName: absentee.name,
          srn: absentee.srn,
          sectionCode,
          attendanceDate,
          subjectName
        })
      };

      if (config.messagingServiceSid) {
        messagePayload.messagingServiceSid = config.messagingServiceSid;
      } else {
        messagePayload.from = config.fromNumber;
      }

      const message = await client.messages.create(messagePayload);
      results.push({
        srn: absentee.srn,
        name: absentee.name,
        to,
        ok: true,
        messageSid: message.sid,
        error: null
      });
    } catch (error) {
      results.push({
        srn: absentee.srn,
        name: absentee.name,
        to,
        ok: false,
        messageSid: null,
        error: error.message
      });
    }
  }

  return {
    ok: true,
    sentCount: results.filter((entry) => entry.ok).length,
    failedCount: results.filter((entry) => !entry.ok).length,
    results
  };
}

module.exports = {
  getTwilioConfig,
  normalizePhoneNumber,
  sendAbsenteeSms
};
