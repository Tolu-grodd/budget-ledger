# Budget Ledger - setup guide

This is a real, buildable web app (Vite + React + Firebase), not a single copy-paste HTML file.
That's on purpose: it's what makes cross-device sync and "install as an app with an icon" actually
possible - those things require the app to be served over HTTPS from a real URL, which a
double-clicked local file can never be.

Do this once. After that, you (and your other PC/phone) just open a URL and sign in.

## 1. Install Node.js (one-time, on the PC you'll build from)

Download the LTS installer from https://nodejs.org and install it. This gives you `node` and `npm`.

## 2. Create your Firebase project (free)

1. Go to https://console.firebase.google.com and click **Add project**. Name it anything (e.g. "budget-ledger"). You can skip Google Analytics.
2. In the left sidebar: **Build > Authentication > Get started**. Click the **Sign-in method** tab, enable **Google**, pick a support email, save.
3. In the left sidebar: **Build > Firestore Database > Create database**. Choose **Production mode**, pick any region close to you, click Enable.
4. Still in Firestore, go to the **Rules** tab, delete everything there, and paste in the contents of `firestore.rules` from this folder. Click **Publish**. (This makes sure only you can read/write your own data.)
5. In the left sidebar: **Project settings** (gear icon) > scroll to **Your apps** > click the **</>** (web) icon > register an app (any nickname) > **do not** check Firebase Hosting yet. You'll see a `firebaseConfig` object - copy it.

## 3. Add your config to the app

Copy `.env.example` to `.env.local` and fill in the six values you copied in step 2.5:

```
cp .env.example .env.local
```

`.env.local` is git-ignored, so your settings stay on your machine.

## 4. Install dependencies and run it locally to test

In a terminal, inside this project folder:

```
npm install
npm run dev
```

Open the URL it prints (usually `http://localhost:5173`). Sign in with Google, and confirm the ledger loads and saving works. Stop it with Ctrl+C when done.

## 5. Deploy so it has a real URL (needed for install + sync)

Install the Firebase CLI once:

```
npm install -g firebase-tools
firebase login
```

Then, inside this project folder:

```
npm run build
firebase init hosting
```

When `firebase init` asks questions:
- "Use an existing project" -> pick the project you made in step 2.
- "What do you want to use as your public directory?" -> type `dist`
- "Configure as a single-page app?" -> **Yes**
- "Set up automatic builds with GitHub?" -> No (unless you want that later)
- If it asks to overwrite `dist/index.html` -> **No**

Then deploy:

```
firebase deploy
```

It'll print a URL like `https://your-project.web.app` - that's your app, live, for good. Anytime you
change the code, just run `npm run build && firebase deploy` again to push updates.

## 6. Install it on each device

- **Phone (Samsung / any Android, Chrome):** open the URL, tap the menu (three dots) > **Add to Home screen** / **Install app**. It'll appear with its own icon like a normal app. You may also see an in-app "Install app" button in the account bar once the browser thinks it's a good moment to offer it.
- **iPhone (Safari):** open the URL, tap Share > **Add to Home Screen**.
- **Windows / Mac (Chrome or Edge):** open the URL, click the install icon in the address bar, or the "Install app" button in the app itself.

Sign in with the same Google account on every device and everything - categories, entries, settings,
rollover toggles - syncs automatically whenever there's an internet connection. If you go offline
mid-edit, your changes are saved locally and sync as soon as you're back online.

## Notes

- Only you can read/write your data (enforced by the Firestore rules in step 2.4), since it's scoped to your signed-in user ID.
- Free tier limits (Spark plan) are generous for personal use - a single-person budget app will not come close to them.
- If you ever want a second person to use this with their own separate data, they just sign in with their own Google account - the app already keys everything by user ID.
