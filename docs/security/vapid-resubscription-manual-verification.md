# VAPID resubscription manual verification

Use dedicated test accounts and non-production VAPID keys. Do not paste
subscription endpoints, encryption keys, authentication secrets, subscription
objects, or VAPID key values into test evidence.

## Preconditions

- The tested environment has a matching VAPID public/private key pair.
- The service worker is active.
- The browser supports Push Manager and Web Notifications.
- Vercel and browser logs are open with sensitive values hidden.

## Scenarios

### New user or no existing subscription

1. Start with notification permission at `default` and no push subscription.
2. Enable notifications through the existing user-facing control.
3. Confirm one browser subscription is created and registered with the server.
4. Confirm only the public-key fingerprint is stored in localStorage.

### Existing subscription using the current key

1. Start with permission `granted` and a subscription created with the current
   VAPID public key.
2. Reload the application and invoke the notification control twice quickly.
3. Confirm the existing subscription is synchronized without replacement.
4. Confirm only one registration request is active at a time.

### Existing subscription using an old key

1. Create a subscription with a non-production old test key.
2. Change the test environment to a new matching key pair and redeploy.
3. Reload the application with permission still `granted`.
4. Confirm the old endpoint is sent to the DELETE API, the browser subscription
   is unsubscribed, and exactly one new subscription is created and registered.
5. Confirm the stored fingerprint changes without storing either VAPID key.

### Browser without applicationServerKey comparison

1. Mock or use a browser where `subscription.options.applicationServerKey` is
   unavailable.
2. Confirm a matching stored fingerprint reuses the subscription.
3. Confirm a missing or different fingerprint replaces the subscription once.

### Permission denied

1. Set notification permission to `denied`.
2. Confirm the application does not create, replace, or register a subscription.
3. Confirm the existing user-facing blocked-permission guidance remains visible.

## Log inspection

- Confirm no endpoint, `p256dh`, `auth`, subscription object, VAPID public key,
  or VAPID private key appears in browser, Vercel, or API logs.
- Confirm failures contain only generic context and HTTP status codes.
- Confirm no duplicate POST requests occur during concurrent subscribe calls.
