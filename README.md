# Salon Admin & Stylist Dashboard

A React + Firebase web app for managing salon branches, appointments, users, products, and services. Features role-based login, CRUD operations, metrics dashboard, and inventory management.

## Features
- Admin dashboard: monitor 4 branches, CRUD for users/appointments/products/services, sales metrics
- Stylist dashboard: view appointments, update status, manage inventory usage
- Role-based login (admin/stylist)
- Firebase backend (Firestore, Auth)
- Gold, white, black, dark grey theme
- Scalable for many users

## Setup
1. Install dependencies
2. Configure Firebase
3. Start the app

## Tech Stack
- React
- Firebase (Firestore, Auth)
- Styled Components (for theme)

---

> Replace this README with more details as the project evolves.

## User creation flow (Admin adds user)

When an admin adds a user in the UI, the app now:

1) Calls a Cloud Function `createAuthUser` to create the user in Firebase Authentication.
2) Writes the user profile to Firestore at `users/{uid}` with the same UID as the Auth user.
3) Does NOT store plain-text passwords in Firestore.

There is also a Firestore trigger that can send a password-setup link on `users/{uid}` creation. The UI sets `skipPasswordSetupEmail: true` to avoid sending this email when a password is already assigned during creation. You can remove that flag if you want to let users set their own password via email.

### Deploying Cloud Functions

After pulling changes, deploy the functions so the callable `createAuthUser` and the updated trigger are available:

```
firebase deploy --only functions
```

Optional: If you use SendGrid for welcome emails/alerts, set the key (or remove email features):

```
firebase functions:config:set sendgrid.key=YOUR_SENDGRID_API_KEY
firebase deploy --only functions
```

Note: Ensure your authenticated caller(s) have the right to create users (e.g., restrict the callable by custom claims `role: 'admin'`). The current function requires the caller to be signed in; you can extend the check as needed.
