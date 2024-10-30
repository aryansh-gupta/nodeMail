require("dotenv").config(); // Ensure to load environment variables
const fs = require("fs");
const nodemailer = require("nodemailer"); // Assuming nodemailer is used

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

const sendMail = async (transporter, mailOptions) => {
  try {
    validateEmailOptions(mailOptions);
    const info = await transporter.sendMail(mailOptions);
    console.log("Email has been sent successfully:", info.response);
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
