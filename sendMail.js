require("dotenv").config(); // Ensure to load environment variables

const mailOptions = {
  from: {
    name: "Ruby",
    address: process.env.USER_EMAIL, // Use environment variable for email
  },
  to: process.env.RECEIVER_EMAILS.split(","), // Use environment variable for receivers
  subject: "Hello ✔",
  text: "Hello world?",
  html: "<b>Hello world?</b>",
};

const sendMail = async (transporter, mailOptions) => {
  if (!transporter || !mailOptions) {
    console.error("Invalid transporter or mail options");
    return;
  }

  try {
    await transporter.sendMail(mailOptions);
    console.log("Email has been sent successfully");
  } catch (error) {
    console.error("Error sending email:", error);
  }
};

// Ensure transporter is defined and configured properly
if (typeof transporter !== "undefined") {
  sendMail(transporter, mailOptions);
} else {
  console.error("Transporter is not defined");
}
