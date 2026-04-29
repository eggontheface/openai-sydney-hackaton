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

This app uses native health modules, so it will not work in Expo Go.

```sh
npm install
npm run prebuild
npm run ios
# or
npm run android
```

Use a physical device with Apple Health or Health Connect data. Android requires Health Connect to be installed or available through the Android system provider.

## Test

The app uses Jest with the Expo preset so data, coach, and UI work can share one test runner.

```sh
npm test
npm run test:watch
npm run test:rollups
npm run test:ci
npm run typecheck
```

Place app tests under `src/` using `*.test.ts` or `*.test.tsx`. Prefer pure TypeScript tests for data and coach logic, React Native Testing Library for component behavior, and `npm run test:rollups` for the platform-neutral daily rollup and legacy migration fixtures.

## Native Notes

- iOS HealthKit access is configured by the `@kingstinct/react-native-healthkit` Expo config plugin in `app.json`.
- Android Health Connect permissions are declared in `app.json`, and the `expo-health-connect` plugin adds the permission rationale activity/alias.
- Health Connect foreground reads can normally access data up to 30 days before the first permission grant. Longer history requires the Health Connect history permission and extra review.

Reference docs:

- Apple HealthKit authorization: https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data
- Android Health Connect raw reads: https://developer.android.com/health-and-fitness/health-connect/read-data
- React Native Health Connect permissions: https://matinzd.github.io/react-native-health-connect/docs/permissions/
