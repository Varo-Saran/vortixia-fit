import webpush from 'web-push';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BIIueWulwJKMBwrYNWiU4Rrp0Pea6HliZUOqy8uXme3sdKqXj9UVo5f6xR4ZkPB9IFLcYG7Y8GVwAu1n6XmFffU';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';

console.log("VAPID Public Key:", vapidPublicKey);
console.log("VAPID Private Key:", vapidPrivateKey ? "FOUND" : "MISSING");

if (!vapidPrivateKey) {
  console.error("Cannot test: VAPID private key is missing in .env.local");
  process.exit(1);
}

webpush.setVapidDetails(
  'mailto:support@vortixia.fit',
  vapidPublicKey,
  vapidPrivateKey
);

const iosSubscription = {
  endpoint: "https://web.push.apple.com/QEa-iKzJ_7X3hPRlStv4JCrAS_iJTEk5Dvp-0yCMuANek2diUk6XmCwzVIqyvGGCW_4HjbB9U_82CEL-BRtdVE4FHeiPTpG-m7fJa2Q-iccHmMZ24TSNiUekabqCL1B1B2kGKwSjYNH9-mmCuDDye3lMkh90QV63nm076ouoZiw",
  keys: {
    p256dh: "BHT1a6OzUOGf/sRkbJhkWUUIt9qF9Do0HhDnnxcCr9jEYNzoVET6PRDSeATw66elhPuLIHTfx8zNkrP00YGZ4lU=",
    auth: "JajLvB/V0onf8UUjKwoeSA=="
  }
};

const payload = JSON.stringify({
  title: "⚔️ iOS Social Arena Test",
  message: "Congratulations! Your iOS push notifications are now 100% operational."
});

async function runTest() {
  console.log("Sending push to Apple APNs server...");
  try {
    const res = await webpush.sendNotification(iosSubscription, payload);
    console.log("Apple APNs Response Status:", res.statusCode);
  } catch (err: any) {
    console.error("Apple APNs Response Error:", err.statusCode, err.body || err.message);
  }
}

runTest();
