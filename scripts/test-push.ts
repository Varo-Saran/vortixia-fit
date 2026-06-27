import webpush from 'web-push';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BIIueWulwJKMBwrYNWiU4Rrp0Pea6HliZUOqy8uXme3sdKqXj9UVo5f6xR4ZkPB9IFLcYG7Y8GVwAu1n6XmFffU';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || 'Rc-gF47G3j0t1s6EgbOGeiANs9YDWnUQWUl9gVNcIxs';

console.log("VAPID Public Key:", vapidPublicKey);
console.log("VAPID Private Key:", vapidPrivateKey ? "FOUND" : "MISSING");

webpush.setVapidDetails(
  'mailto:support@vortixia.fit',
  vapidPublicKey,
  vapidPrivateKey
);

const targetSubscriptions = [
  {
    endpoint: "https://fcm.googleapis.com/fcm/send/eB92UFI_B4Y:APA91bHO9iWLPgNbylH7n6hXqgcy5SSBaIStqMZCMlbuBwo3Adsx9KUETlw9S8cZ0Ra-5QyvO1huE4cOWsLWOSbqi7IjLQe681oEmxZhH5QSMZnblkfm_rYFmPd6ZMOE89yVP8m6FqEm",
    keys: {
      p256dh: "BD+rpLE+eM9VgeEzw+1iFeTX9GsJJYfOA3sTeG1wIjUS+3SWLaxSzY/b7tFswsgld/d6FfykkHdmc8/h+53yGN0=",
      auth: "UZa+Mw6ghoRnYJNCHdXPKQ=="
    }
  },
  {
    endpoint: "https://fcm.googleapis.com/fcm/send/fePRfuCavCk:APA91bEAzHTH8IO-cO2T7ouJLcTifYuad7cvPSJx5PgHhtfN1DWyULJu-EaTe7cEiMDEqxkBx5BVp9a3dOlPivEBkXYdLRbmcDyPAEAaU92V_-bf4_sVmKAlQz2L5JNMuwWXXRmh3Php",
    keys: {
      p256dh: "BFgHX5rbNSIv/yYKHgNpFP+JCK7QPZmqTQBRw7DJM2BI5+Z3ujh0phyDjq7BgczL+ARpfEs/B2CtB7ZqQuBt3mk=",
      auth: "ujUfWojrj/u1tuVTdJeuXA=="
    }
  }
];

const payload = JSON.stringify({
  title: "⚔️ Social Arena Active!",
  message: "Your push notification system is 100% operational. Let's crush today's split!"
});

async function triggerTest() {
  console.log("Triggering test pushes...");
  for (const sub of targetSubscriptions) {
    try {
      console.log(`Sending to endpoint: ${sub.endpoint.substring(0, 60)}...`);
      const response = await webpush.sendNotification(sub, payload);
      console.log("Response status:", response.statusCode);
    } catch (err: any) {
      console.error("Error sending push:", err.statusCode, err.body || err.message);
    }
  }
}

triggerTest();
