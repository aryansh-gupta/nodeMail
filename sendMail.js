require("dotenv").config(); // Ensure to load environment variables
const fs = require("fs");
const nodemailer = require("nodemailer"); // Assuming nodemailer is used

// Feature config: retries and dry-run
const MAX_RETRIES = Number(process.env.MAX_RETRIES || 3);
const RETRY_BASE_DELAY_MS = Number(process.env.RETRY_BASE_DELAY_MS || 500);
const DRY_RUN = String(process.env.DRY_RUN || "").toLowerCase() === "true";

const mailOptions = {
  from: {
    name: "Ruby",
    address: process.env.USER_EMAIL, // Use environment variable for email
  },
  to: process.env.RECEIVER_EMAILS.split(","), // Use environment variable for receivers
  cc: process.env.CC_EMAILS ? process.env.CC_EMAILS.split(",") : [], // Optional CC
  bcc: process.env.BCC_EMAILS ? process.env.BCC_EMAILS.split(",") : [], // Optional BCC
  subject: "Hello ✔",
  text: "Hello world?",
  html: "<b>Hello world?</b>",
  attachments: [
    {
      filename: "example.txt",
      path: "./example.txt", // Example attachment
    },
  ],
};

const validateEmailOptions = (options) => {
  if (!options.from || !options.to || !options.subject || !options.text) {
    throw new Error("Missing required email fields");
  }
};

// Helpers for retry/backoff
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shouldRetry = (error) => {
  // Retry on transient failures: 5xx, connection issues, timeouts
  const transientCodes = new Set([
    "ECONNECTION",
    "ETIMEDOUT",
    "ESOCKET",
    "EDNS",
  ]);
  if (error && transientCodes.has(error.code)) return true;
  const code = error && (error.responseCode || error.statusCode);
  return typeof code === "number" && code >= 500 && code < 600;
};

const sendMail = async (transporter, mailOptions) => {
  try {
    validateEmailOptions(mailOptions);

    if (DRY_RUN) {
      console.log("[DRY_RUN] Email not sent. Preview:");
      console.log(JSON.stringify(mailOptions, null, 2));
      return;
    }

    let attempt = 0;
    while (true) {
      try {
        attempt++;
        const info = await transporter.sendMail(mailOptions);
        console.log(
          "Email has been sent successfully:",
          info.response || info.messageId
        );
        return;
      } catch (err) {
        const retryable = shouldRetry(err) && attempt <= MAX_RETRIES;
        console.error(
          `Send attempt ${attempt} failed${retryable ? ", will retry" : ""}:`,
          err && (err.message || err)
        );
        if (!retryable) throw err;
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await sleep(delay);
      }
    }
  } catch (error) {
    console.error("Error sending email:", error);
  }
};

// Ensure transporter is defined and configured properly
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.USER_EMAIL,
    pass: process.env.USER_PASSWORD,
  },
});

if (transporter) {
  sendMail(transporter, mailOptions);
} else {
  console.error("Transporter is not defined");
}
