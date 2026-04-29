#!/usr/bin/env bash
set -euo pipefail

app_package="com.openaisydney.trainingpipeline"
app_scheme="trainingpipeline"
metro_port="${METRO_PORT:-8081}"
serial="${ANDROID_SERIAL:-${1:-}}"

if ! command -v adb >/dev/null 2>&1; then
  echo "adb is not available on PATH." >&2
  exit 1
fi

if [ -z "$serial" ]; then
  devices="$(adb devices | awk 'NR > 1 && $2 == "device" { print $1 }')"
  device_count="$(printf '%s\n' "$devices" | sed '/^$/d' | wc -l | tr -d ' ')"

  if [ "$device_count" -eq 1 ]; then
    serial="$devices"
  else
    echo "Choose one Android device with ANDROID_SERIAL=<serial> or pass the serial as the first argument." >&2
    adb devices -l >&2
    exit 1
  fi
fi

if ! adb -s "$serial" get-state >/dev/null 2>&1; then
  echo "Android device '$serial' is not connected." >&2
  exit 1
fi

if ! adb -s "$serial" shell pm path "$app_package" >/dev/null 2>&1; then
  echo "$app_package is not installed on '$serial'. Run npx expo run:android for that device first." >&2
  exit 1
fi

adb -s "$serial" reverse "tcp:$metro_port" "tcp:$metro_port"

encoded_url="http%3A%2F%2F127.0.0.1%3A${metro_port}"
dev_client_url="${app_scheme}://expo-development-client/?url=${encoded_url}"

echo "Starting Metro for Android device '$serial'."
echo "Reload from this terminal with: r"
echo "Reload from another terminal with:"
echo "  adb -s $serial shell am start -a android.intent.action.VIEW -d '$dev_client_url' $app_package"

(
  sleep 4
  adb -s "$serial" shell am start \
    -a android.intent.action.VIEW \
    -d "$dev_client_url" \
    "$app_package" >/dev/null
) &

npm run start:dev-client -- --localhost -c --port "$metro_port"
