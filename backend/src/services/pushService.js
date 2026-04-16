const webpush = require("web-push");

const PushSubscription = require("../models/PushSubscription");

let vapidConfigured = false;

const ensureVapidConfig = () => {
  if (vapidConfigured) return true;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@holoid.local";

  if (!publicKey || !privateKey) {
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
};

const getPushPublicKey = () => process.env.VAPID_PUBLIC_KEY || "";

const registerPushSubscription = async ({ userId, hospitalId, subscription, userAgent }) => {
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    throw new Error("Invalid push subscription payload");
  }

  const update = {
    user: userId,
    hospital: hospitalId || null,
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth
    },
    userAgent: String(userAgent || ""),
    active: true,
    failureReason: ""
  };

  const doc = await PushSubscription.findOneAndUpdate(
    { endpoint: subscription.endpoint },
    { $set: update },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return doc;
};

const unregisterPushSubscription = async ({ userId, endpoint }) => {
  if (!endpoint) return null;

  return PushSubscription.findOneAndUpdate(
    { user: userId, endpoint },
    { $set: { active: false } },
    { new: true }
  );
};

const sendPushToUser = async ({ userId, title, body, data = {} }) => {
  if (!ensureVapidConfig()) {
    return { skipped: true, reason: "VAPID_NOT_CONFIGURED", delivered: 0, attempted: 0 };
  }

  const subscriptions = await PushSubscription.find({ user: userId, active: true }).lean();
  if (!subscriptions.length) {
    return { skipped: true, reason: "NO_ACTIVE_SUBSCRIPTIONS", delivered: 0, attempted: 0 };
  }

  const payload = JSON.stringify({
    title,
    body,
    data,
    timestamp: new Date().toISOString()
  });

  let delivered = 0;

  await Promise.all(
    subscriptions.map(async (entry) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: entry.endpoint,
            keys: {
              p256dh: entry.keys?.p256dh,
              auth: entry.keys?.auth
            }
          },
          payload
        );

        delivered += 1;
        await PushSubscription.updateOne(
          { _id: entry._id },
          {
            $set: {
              lastSuccessAt: new Date(),
              failureReason: "",
              active: true
            }
          }
        );
      } catch (error) {
        const statusCode = Number(error?.statusCode || 0);
        const shouldDisable = [404, 410].includes(statusCode);

        await PushSubscription.updateOne(
          { _id: entry._id },
          {
            $set: {
              lastFailureAt: new Date(),
              failureReason: String(error?.message || "PUSH_SEND_FAILED"),
              active: shouldDisable ? false : true
            }
          }
        );
      }
    })
  );

  return {
    skipped: false,
    attempted: subscriptions.length,
    delivered
  };
};

module.exports = {
  getPushPublicKey,
  registerPushSubscription,
  unregisterPushSubscription,
  sendPushToUser
};
