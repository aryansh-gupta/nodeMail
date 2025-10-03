require("dotenv").config(); // Ensure to load environment variables
const fs = require("fs");
const nodemailer = require("nodemailer"); // Assuming nodemailer is used
let handlebars = null;
try {
  handlebars = require("handlebars");
} catch (e) {
  // Optional dependency; if missing, templates won't be compiled
  console.warn("handlebars not installed; skipping template compilation");
}

// Feature config: retries and dry-run
const MAX_RETRIES = Number(process.env.MAX_RETRIES || 3);
const RETRY_BASE_DELAY_MS = Number(process.env.RETRY_BASE_DELAY_MS || 500);
const DRY_RUN = String(process.env.DRY_RUN || "").toLowerCase() === "true";
const ATTACHMENTS_DIR = process.env.ATTACHMENTS_DIR || "";
const TEMPLATE_FILE = process.env.TEMPLATE_FILE || "";
const TEMPLATE_DATA = process.env.TEMPLATE_DATA || ""; // JSON string
const TEMPLATE_DATA_FILE = process.env.TEMPLATE_DATA_FILE || "";
const SUBJECT_OVERRIDE = process.env.SUBJECT || "";
const BODY_TEXT_OVERRIDE = process.env.BODY_TEXT || "";
const BODY_HTML_OVERRIDE = process.env.BODY_HTML || "";

// Collect attachments from a directory (non-recursive)
const getAttachmentsFromDir = (dirPath) => {
  if (!dirPath) return [];
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries
      .filter((d) => d.isFile())
      .map((d) => ({ filename: d.name, path: `${dirPath}/${d.name}` }));
  } catch (e) {
    console.warn("ATTACHMENTS_DIR not usable:", e && (e.message || e));
    return [];
  }
};

const dirAttachments = getAttachmentsFromDir(ATTACHMENTS_DIR);

// Load template data
const loadTemplateData = () => {
  try {
    if (TEMPLATE_DATA) {
      return JSON.parse(TEMPLATE_DATA);
    }
    if (TEMPLATE_DATA_FILE) {
      const jsonStr = fs.readFileSync(TEMPLATE_DATA_FILE, "utf8");
      return JSON.parse(jsonStr);
    }
  } catch (e) {
    console.warn("Template data not usable:", e && (e.message || e));
  }
  return {};
};

// Compile template into HTML if provided
let compiledHtmlFromTemplate = "";
if (TEMPLATE_FILE) {
  try {
    const tpl = fs.readFileSync(TEMPLATE_FILE, "utf8");
    if (handlebars) {
      const template = handlebars.compile(tpl);
      compiledHtmlFromTemplate = template(loadTemplateData());
    } else {
      // Fallback: no templating, use raw content
      compiledHtmlFromTemplate = tpl;
    }
  } catch (e) {
    console.warn("Failed to load/compile template:", e && (e.message || e));
  }
}

// Simple HTML to text fallback
const htmlToText = (html) =>
  (html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

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
    ...dirAttachments,
  ],
};

// Apply overrides and template rendering (priority: explicit env > template > defaults)
if (SUBJECT_OVERRIDE) {
  mailOptions.subject = SUBJECT_OVERRIDE;
}
if (BODY_HTML_OVERRIDE) {
  mailOptions.html = BODY_HTML_OVERRIDE;
}
if (BODY_TEXT_OVERRIDE) {
  mailOptions.text = BODY_TEXT_OVERRIDE;
}
if (compiledHtmlFromTemplate) {
  mailOptions.html = compiledHtmlFromTemplate;
  if (!BODY_TEXT_OVERRIDE) {
    mailOptions.text = htmlToText(compiledHtmlFromTemplate);
  }
}

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
