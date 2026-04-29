# OpenAI Sydney Hackathon

Wellness insights app exploring how to help people understand the health and fitness data already on their phone.

## Direction

- iOS data source: Apple Health via HealthKit.
- Android data source: Health Connect.
- App approach: React Native with native health-data modules.
- Product scope: wellness insights, not diagnosis or medical advice.

## Training Pipeline

The mobile app imports personal training data from Apple Health on iOS or Health Connect on Android into a local SQLite pipeline.

### What It Imports

- Steps
- Active and total energy
- Walking/running distance
- Heart rate, resting heart rate, HRV, and VO2 max
- Sleep sessions and stages
- Workouts / exercise sessions
- Weight, body fat, and lean body mass
- Nutrition and hydration

Records are normalized into platform-neutral tables, including `health_samples`, `sleep_sessions`, `workouts`, `nutrition_daily`, and `daily_metrics`, and can be exported as JSON from the app.

## Run Locally

This app uses native health modules, so it will not work in Expo Go. Build a native dev client with Expo instead.

### Prerequisites

- Node.js LTS and npm.
- Android Studio with the Android SDK and either a running emulator or a USB-connected Android device.
- Xcode for iOS builds.
- Health data access requires a physical device: Apple Health on iOS or Health Connect on Android. An Android emulator is useful for checking the UI, but it will not have real Health Connect data.

Check that Android can see a target before running:

```sh
adb devices
```

### First Setup

```sh
npm install
npm run prebuild
```

`npm run android` and `npm run ios` can also create the native directories automatically if they do not exist, but running `prebuild` explicitly makes that step visible.

### Android

Start an emulator from Android Studio or connect a device, then run:

```sh
npm run android
```

For a connected physical device:

```sh
npm run android -- --device
```

Android requires Health Connect to be installed or available through the Android system provider.

### iOS

Run on the default simulator:

```sh
npm run ios
```

Run on a connected physical device:

```sh
npm run ios -- --device
```

### After The Native App Is Installed

Start the Expo dev server for the installed dev client:

```sh
npm start
```

Re-run `npm run android` or `npm run ios` after changing native dependencies, Expo config, permissions, or config plugins.

## Native Notes

- iOS HealthKit access is configured by the `@kingstinct/react-native-healthkit` Expo config plugin in `app.json`.
- Android Health Connect permissions are declared in `app.json`, and the `expo-health-connect` plugin adds the permission rationale activity/alias.
- Health Connect foreground reads can normally access data up to 30 days before the first permission grant. Longer history requires the Health Connect history permission and extra review.

Reference docs:

- Apple HealthKit authorization: https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data
- Android Health Connect raw reads: https://developer.android.com/health-and-fitness/health-connect/read-data
- React Native Health Connect permissions: https://matinzd.github.io/react-native-health-connect/docs/permissions/
