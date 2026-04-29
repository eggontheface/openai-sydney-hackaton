# Training Pipeline

Small Expo dev-client app for importing personal training data from Apple Health on iOS or Health Connect on Android into a local SQLite pipeline.

## What It Imports

- Steps
- Active energy
- Walking/running distance
- Heart-rate samples
- Workouts / exercise sessions

All records are normalized into `health_samples` in `training_pipeline.db` and can be exported as JSON from the app.

## Run Locally

This app uses native health modules, so it will not work in Expo Go.

```sh
npm install
npm run prebuild
npm run ios
# or
npm run android
```

Use a physical device with Apple Health or Health Connect data. Android requires Health Connect to be installed or available through the Android system provider.

## Native Notes

- iOS HealthKit access is configured by the `@kingstinct/react-native-healthkit` Expo config plugin in `app.json`.
- Android Health Connect permissions are declared in `app.json`, and the `expo-health-connect` plugin adds the permission rationale activity/alias.
- Health Connect foreground reads can normally access data up to 30 days before the first permission grant. Longer history requires the Health Connect history permission and extra review.

Reference docs:

- Apple HealthKit authorization: https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data
- Android Health Connect raw reads: https://developer.android.com/health-and-fitness/health-connect/read-data
- React Native Health Connect permissions: https://matinzd.github.io/react-native-health-connect/docs/permissions/
