const functions = require("firebase-functions");
const admin = require("firebase-admin");
const sgMail = require("@sendgrid/mail");
admin.initializeApp();
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.notifyLowStock = functions.firestore
    .document("products/{productId}")
    .onUpdate((change, context) => {
      const before = change.before.data();
      const after = change.after.data();
      if (before.stocks >= 5 && after.stocks < 5) {
        const msg = {
          to: "admin@example.com", // Change to your admin email
          from: "noreply@yourdomain.com",
          subject: `Low Stock Alert: ${after.name}`,
          text: `Product ${after.name} is low on stock (${after.stocks} left).`,
        };
        return sgMail.send(msg);
      }
      return null;
    });
