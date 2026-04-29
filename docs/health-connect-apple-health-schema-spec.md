# Health Connect / Apple Health Schema Spec

## Purpose

This document summarizes the current coaching data model and defines the target schema for pivoting the primary wellness source from GarminDB / Health Sync CSVs toward Android Health Connect and Apple Health / HealthKit.

The goal is to preserve the current coaching behavior while making the source layer platform-neutral.

## Source References

- Android Health Connect data types: https://developer.android.com/health-and-fitness/health-connect/data-types
- Android Health Connect records package: https://developer.android.com/reference/kotlin/androidx/health/connect/client/records/package-summary
- Health Connect `SleepSessionRecord`: https://developer.android.com/reference/kotlin/androidx/health/connect/client/records/SleepSessionRecord
- Health Connect `ExerciseSessionRecord`: https://developer.android.com/reference/kotlin/androidx/health/connect/client/records/ExerciseSessionRecord
- Health Connect `NutritionRecord`: https://developer.android.com/reference/kotlin/androidx/health/connect/client/records/NutritionRecord
- Apple HealthKit quantity identifiers: https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier
- Apple HealthKit category identifiers: https://developer.apple.com/documentation/healthkit/hkcategorytypeidentifier
- Apple `HKWorkout`: https://developer.apple.com/documentation/healthkit/hkworkout
- Apple `HKWorkoutRoute`: https://developer.apple.com/documentation/healthkit/hkworkoutroute

## Current Repo Sources

Current artifacts are built mainly by:

- `pipelines/build_daily_metrics.py`
- `pipelines/build_athlete_capacity_profile.py`
- `pipelines/import_healthsync_nutrition.py`
- `pipelines/import_withings_sleep.py`
- `pipelines/push_healthsync_nutrition_to_intervals.py`

Current source stack:

- GarminDB for daily wellness, sleep, HRV, resting HR, body battery, stress, activities, and historical activity summaries.
- Health Sync Google Drive exports for nutrition, recent sleep fallback, recent steps fallback, and recent active energy fallback.
- Withings direct API for richer sleep detail.
- Intervals.icu for cycling power, FTP-adjacent fields, workout streams, and future training-load/calendar context.

## Current Canonical Artifacts

- `data/derived/daily_metrics.sqlite`
- `data/derived/daily_metrics.json`
- `data/derived/current_state.json`
- `data/derived/athlete_capacity_profile.json`
- `data/derived/athlete_history_summary.md`
- `data/derived/athlete_wellness_summary.md`
- `data/derived/health_check.md`
- `data/publish/llm/latest/llm_bundle.json`

## Current Recommendation Logic

The repo does not yet contain a standalone deterministic recommendation engine. It builds AI-facing artifacts and prompt guardrails.

Current coaching logic:

- Recent 90-day and 365-day training history outrank lifetime bests.
- Historical peaks inform long-term potential, not immediate prescription.
- Current capacity is summarized over 90d, 365d, and 1095d windows.
- Daily activity is grouped into run, ride, strength, and other buckets.
- Current windows include sessions, active days, elapsed seconds, run km, ride km, strength sessions, and training load.
- Historical rolling peaks are computed for 90d run km, 90d ride km, 90d training load, 90d strength sessions, 365d run km, and 365d ride km.
- Guardrail ratios compare current 90d values to historical 90d peaks.
- `current_capacity_well_below_historical_peak` is true if run, ride, or load ratio is below 0.5.
- Weekly consistency is summarized as active/run/ride/strength week ratios, longest streaks, medians, and bucket counts.
- Recovery baselines use 30d, 90d, and 365d medians for sleep, HRV, resting HR, and body battery minimum.
- Recovery variability uses IQR for sleep, HRV, and resting HR.
- High-load day threshold is the 75th percentile of non-zero daily training load.
- Load-response heuristics compare next-day sleep, HRV, and resting HR after any workout, after high-load days, and after rest days.
- Same-day live body battery is unavailable; `body_battery_max` is treated only as a wake-up proxy.
- Nutrition is current-state support context only and is not used to infer historical capacity.
- If recovery and capacity disagree, prompts choose the more conservative training recommendation.

## Current Source Priority Rules

Sleep:

- Prefer Withings sleep when present.
- Else use Garmin sleep.
- Else use recent Health Sync sleep fallback for the last 48 hours.
- Preserve source-specific fields alongside `sleep_seconds`.

Steps and active calories:

- Prefer Garmin daily values.
- Use recent Health Sync fallback only when the Garmin daily row is lagging.

HRV and resting HR:

- Prefer Garmin daily values.
- Use Intervals wellness fallback when Garmin is missing.

Nutrition:

- Daily totals come from Health Sync nutrition CSV snapshots.
- ETL rebuilds the whole day from mutable source files.
- Intervals push uses only calories, carbs, protein, and fat.

## Target Data Model

The pivot should separate raw platform events from derived coaching facts.

### `health_samples`

Platform-neutral raw sample table. One row per sample, session, or summary record.

| Column | Type | Notes |
| --- | --- | --- |
| `sample_id` | text primary key | Stable source ID or deterministic hash. |
| `platform` | text | `health_connect`, `healthkit`, `garmin`, `withings`, `intervals`, `manual`. |
| `record_type` | text | Source record type, such as `StepsRecord` or `HKQuantityTypeIdentifier.stepCount`. |
| `canonical_type` | text | Internal type, such as `steps`, `sleep_session`, `heart_rate`. |
| `source_app` | text | Package name, bundle ID, or upstream source name. |
| `source_device` | text | Device model/name when available. |
| `start_at` | text | ISO timestamp with timezone when possible. |
| `end_at` | text | ISO timestamp with timezone when possible. |
| `local_date` | text | Local athlete date used for daily rollups. |
| `timezone` | text | IANA timezone if available. |
| `value` | real | Scalar value when the sample is scalar. |
| `unit` | text | Canonical unit. |
| `metadata_json` | text | Original IDs, stages, samples, laps, permissions, confidence, route references. |
| `source_modified_at` | text | Source modification timestamp if available. |
| `imported_at` | text | Ingestion timestamp. |

### `sleep_sessions`

One row per sleep session.

| Column | Type | Notes |
| --- | --- | --- |
| `sleep_id` | text primary key | Source ID or deterministic hash. |
| `platform` | text | Source platform. |
| `source_app` | text | App that wrote the session. |
| `start_at` | text | Sleep start. |
| `end_at` | text | Wake/end time. |
| `wake_date` | text | Local date assigned to the sleep. |
| `sleep_seconds` | integer | Non-awake duration. |
| `time_in_bed_seconds` | integer | Full session duration when available. |
| `deep_sleep_seconds` | integer | Stage-derived. |
| `light_sleep_seconds` | integer | Stage-derived. |
| `rem_sleep_seconds` | integer | Stage-derived. |
| `awake_seconds` | integer | Stage-derived. |
| `sleep_stage_json` | text | Full stage timeline. |
| `sleep_score` | real | Vendor score when available. |
| `sleep_efficiency` | real | Derived or vendor-provided. |
| `sleep_latency_seconds` | integer | If available. |
| `wakeup_count` | integer | If available. |
| `waso_seconds` | integer | Wake after sleep onset. |
| `avg_sleep_hr_bpm` | real | If available. |
| `min_sleep_hr_bpm` | real | If available. |
| `max_sleep_hr_bpm` | real | If available. |
| `overnight_hrv_ms` | real | Keep method in metadata. |
| `respiratory_rate` | real | If available. |
| `oxygen_saturation_avg_pct` | real | If available. |
| `temperature_avg_c` | real | If available. |
| `snoring_seconds` | integer | Vendor-specific. |
| `apnea_index` | real | Vendor-specific. |
| `raw_json` | text | Source payload. |

### `workouts`

One row per workout/activity.

| Column | Type | Notes |
| --- | --- | --- |
| `workout_id` | text primary key | Stable source ID or deterministic hash. |
| `platform` | text | Source platform. |
| `source_app` | text | App/source that wrote the workout. |
| `start_at` | text | Local or timezone-aware start. |
| `end_at` | text | End. |
| `local_date` | text | Date used for daily rollups. |
| `name` | text | Workout name/title. |
| `activity_type` | text | Source activity type. |
| `sport_bucket` | text | `run`, `ride`, `strength`, `swim`, `walk`, `other`. |
| `elapsed_seconds` | integer | Full elapsed duration. |
| `moving_seconds` | integer | Moving/active duration when available. |
| `distance_km` | real | Canonical distance. |
| `active_kcal` | real | Active energy. |
| `total_kcal` | real | Total energy when available. |
| `avg_hr_bpm` | real | Summary or derived from stream. |
| `max_hr_bpm` | real | Summary or derived from stream. |
| `avg_speed_mps` | real | If available. |
| `max_speed_mps` | real | If available. |
| `avg_cadence_rpm` | real | If available. |
| `max_cadence_rpm` | real | If available. |
| `avg_power_w` | real | If available. |
| `normalized_power_w` | real | External/derived; not native to Health Connect/HealthKit. |
| `training_load` | real | Prefer Intervals or derived model. |
| `training_effect` | real | Vendor-specific. |
| `anaerobic_training_effect` | real | Vendor-specific. |
| `vo2max` | real | If attached or nearest daily sample. |
| `route_available` | integer | 0/1. |
| `route_ref` | text | Route payload or foreign key. |
| `laps_json` | text | Laps/segments. |
| `streams_json` | text | Optional raw series references. |
| `raw_json` | text | Source payload. |

### `nutrition_daily`

One row per local date after summing all nutrition events.

| Column | Type | Notes |
| --- | --- | --- |
| `date` | text primary key | Local athlete date. |
| `kcal_in` | real | Dietary energy consumed. |
| `protein_g` | real | Protein. |
| `carbs_g` | real | Total carbohydrate. |
| `fat_g` | real | Total fat. |
| `saturated_fat_g` | real | Optional. |
| `monounsaturated_fat_g` | real | Optional. |
| `polyunsaturated_fat_g` | real | Optional. |
| `trans_fat_g` | real | Optional. |
| `fiber_g` | real | Fiber. |
| `sugar_g` | real | Sugar. |
| `cholesterol_mg` | real | Cholesterol. |
| `water_ml` | real | Hydration/water. |
| `caffeine_mg` | real | Optional. |
| `sodium_mg` | real | Optional. |
| `potassium_mg` | real | Optional. |
| `calcium_mg` | real | Optional. |
| `iron_mg` | real | Optional. |
| `magnesium_mg` | real | Optional. |
| `zinc_mg` | real | Optional. |
| `vitamin_a_mcg` | real | Optional. |
| `vitamin_b6_mg` | real | Optional. |
| `vitamin_b12_mcg` | real | Optional. |
| `vitamin_c_mg` | real | Optional. |
| `vitamin_d_mcg` | real | Optional. |
| `vitamin_e_mg` | real | Optional. |
| `vitamin_k_mcg` | real | Optional. |
| `all_nutrients_json` | text | Preserve every numeric nutrient field. |
| `entry_count` | integer | Number of source rows/events. |
| `meal_count` | integer | Count of meals if meal IDs/names are present. |
| `source_modified_at` | text | Latest source modification. |
| `imported_at` | text | ETL time. |

### `daily_metrics`

This remains the AI-facing daily rollup table.

#### Identity and Completeness

| Field | Type | Notes |
| --- | --- | --- |
| `date` | text primary key | Local athlete date. |
| `data_completeness` | text | `empty`, `partial`, `full`. |
| `wellness_data_status` | text | Source status label. |
| `source_count` | integer | Count of major available domains. |
| `has_platform_wellness` | integer | Health Connect or HealthKit wellness data present. |
| `has_activity` | integer | Workout/activity present. |
| `has_nutrition` | integer | Nutrition present. |
| `has_sleep` | integer | Sleep present. |
| `has_steps` | integer | Steps present. |
| `has_energy` | integer | Energy present. |

#### Body and Composition

| Field | Type | Health Connect | Apple HealthKit | Notes |
| --- | --- | --- | --- | --- |
| `weight_kg` | real | `WeightRecord` | `bodyMass` | Direct. |
| `height_m` | real | `HeightRecord` | `height` | Direct. |
| `bmi` | real | Derived | `bodyMassIndex` or derived | Prefer derived from height/weight if source quality varies. |
| `body_fat_pct` | real | `BodyFatRecord` | `bodyFatPercentage` | Direct. |
| `lean_body_mass_kg` | real | `LeanBodyMassRecord` | `leanBodyMass` | Direct. |
| `body_water_kg` | real | `BodyWaterMassRecord` | Usually unavailable | Health Connect direct. |
| `bone_mass_kg` | real | `BoneMassRecord` | Usually unavailable | Health Connect direct. |
| `waist_circumference_m` | real | Not standard | `waistCircumference` | Apple direct. |
| `visceral_fat` | real | Vendor-specific | Vendor-specific | Preserve from device metadata if available. |
| `metabolic_age` | real | Vendor-specific | Vendor-specific | Preserve from device metadata if available. |
| `physique_rating` | real | Vendor-specific | Vendor-specific | Preserve from device metadata if available. |

#### Recovery and Vitals

| Field | Type | Health Connect | Apple HealthKit | Notes |
| --- | --- | --- | --- | --- |
| `resting_hr` | real | `RestingHeartRateRecord` | `restingHeartRate` | Direct. |
| `heart_rate_avg_bpm` | real | `HeartRateRecord` | `heartRate` | Derived from samples. |
| `heart_rate_min_bpm` | real | `HeartRateRecord` | `heartRate` | Derived from samples. |
| `heart_rate_max_bpm` | real | `HeartRateRecord` | `heartRate` | Derived from samples. |
| `hrv_last_night_avg` | real | `HeartRateVariabilityRmssdRecord` | `heartRateVariabilitySDNN` | Not method-equivalent; store method. |
| `hrv_weekly_avg` | real | Derived | Derived | Use same method per source. |
| `hrv_status` | text | Derived/vendor | Derived/vendor | Garmin-style status is not native. |
| `respiratory_rate` | real | `RespiratoryRateRecord` | `respiratoryRate` | Direct. |
| `oxygen_saturation_avg_pct` | real | `OxygenSaturationRecord` | `oxygenSaturation` | Direct. |
| `vo2max` | real | `Vo2MaxRecord` | `vo2Max` | Direct when present. |
| `body_temperature_c` | real | `BodyTemperatureRecord` | `bodyTemperature` | Direct. |
| `basal_body_temperature_c` | real | `BasalBodyTemperatureRecord` | `basalBodyTemperature` | Direct. |
| `blood_pressure_systolic_mmhg` | real | `BloodPressureRecord` | `bloodPressureSystolic` | Optional. |
| `blood_pressure_diastolic_mmhg` | real | `BloodPressureRecord` | `bloodPressureDiastolic` | Optional. |
| `blood_glucose_mmol_l` | real | `BloodGlucoseRecord` | `bloodGlucose` | Optional. |
| `stress_avg` | real | Vendor-specific/derived | Vendor-specific/derived | No direct standard equivalent. |
| `body_battery_min` | integer | Garmin/vendor only | Garmin/vendor only | No direct standard equivalent. |
| `body_battery_max` | integer | Garmin/vendor only | Garmin/vendor only | No direct standard equivalent. |
| `body_battery_charged` | integer | Garmin/vendor only | Garmin/vendor only | No direct standard equivalent. |

#### Sleep

| Field | Type | Health Connect | Apple HealthKit | Notes |
| --- | --- | --- | --- | --- |
| `sleep_seconds` | integer | `SleepSessionRecord` | `sleepAnalysis` | Non-awake duration. |
| `sleep_seconds_source` | text | Metadata | Metadata | Preserve source. |
| `time_in_bed_seconds` | integer | `SleepSessionRecord` | `sleepAnalysis` | Full session or in-bed category. |
| `deep_sleep_seconds` | integer | Sleep stages | Sleep stages | Direct if stages present. |
| `light_sleep_seconds` | integer | Sleep stages | Core/light sleep category | Apple stage naming differs. |
| `rem_sleep_seconds` | integer | Sleep stages | REM sleep category | Direct if stages present. |
| `awake_seconds` | integer | Sleep stages | Awake category | Direct if stages present. |
| `sleep_score` | real | Vendor-specific | Vendor-specific | Not standard. |
| `sleep_efficiency` | real | Derived/vendor | Derived/vendor | Derive from sleep/time in bed. |
| `sleep_latency_seconds` | integer | Derived/vendor | Derived/vendor | May require stage timeline. |
| `wakeup_count` | integer | Derived/vendor | Derived/vendor | May require stage timeline. |
| `waso_seconds` | integer | Derived/vendor | Derived/vendor | May require stage timeline. |
| `overnight_hrv_ms` | real | HRV samples during sleep | HRV samples during sleep | Derived. |
| `avg_sleep_hr_bpm` | real | HR samples during sleep | HR samples during sleep | Derived. |
| `sleep_respiratory_rate` | real | RR samples during sleep | RR samples during sleep | Derived. |
| `sleep_spo2_avg_pct` | real | SpO2 samples during sleep | SpO2 samples during sleep | Derived. |
| `snoring_seconds` | integer | Vendor-specific | Vendor-specific | Not standard. |
| `apnea_index` | real | Vendor-specific | Vendor-specific | Not standard. |

#### Activity and Daily Movement

| Field | Type | Health Connect | Apple HealthKit | Notes |
| --- | --- | --- | --- | --- |
| `steps` | integer | `StepsRecord` | `stepCount` | Direct. |
| `steps_source` | text | Metadata | Metadata | Preserve source. |
| `active_kcal` | real | `ActiveCaloriesBurnedRecord` | `activeEnergyBurned` | Direct. |
| `total_kcal` | real | `TotalCaloriesBurnedRecord` | Active + basal derived | Direct in Health Connect, derived in Apple. |
| `basal_kcal` | real | `BasalMetabolicRateRecord` or derived | `basalEnergyBurned` | Unit normalization needed. |
| `distance_km` | real | `DistanceRecord` | Distance identifiers | Direct or workout-derived. |
| `floors_climbed` | real | `FloorsClimbedRecord` | `flightsClimbed` | Unit semantics differ. |
| `elevation_gain_m` | real | `ElevationGainedRecord` | Workout route/metadata | Direct in Health Connect. |
| `exercise_seconds` | integer | `ExerciseSessionRecord` | `appleExerciseTime` or workouts | Prefer workout/session-derived. |
| `stand_seconds` | integer | Not standard | `appleStandTime` | Apple-specific. |
| `move_time_seconds` | integer | Not standard | `appleMoveTime` | Apple-specific. |
| `mindfulness_seconds` | integer | `MindfulnessSessionRecord` | `mindfulSession` | Useful for recovery context. |

#### Workouts and Training

| Field | Type | Health Connect | Apple HealthKit | Notes |
| --- | --- | --- | --- | --- |
| `workout_count` | integer | `ExerciseSessionRecord` | `HKWorkout` | Daily count. |
| `run_workout_count` | integer | Exercise type | Workout activity type | Bucketed. |
| `ride_workout_count` | integer | Exercise type | Workout activity type | Bucketed. |
| `strength_workout_count` | integer | Exercise type | Workout activity type | Bucketed. |
| `other_workout_count` | integer | Exercise type | Workout activity type | Bucketed. |
| `activity_elapsed_seconds` | integer | Session duration | Workout duration | Direct. |
| `activity_moving_seconds` | integer | Active duration if available | Derived from samples/workout | Often derived. |
| `activity_kcal` | real | Session energy or active energy | `totalEnergyBurned` / active energy | Normalize. |
| `training_load` | real | External/derived | External/derived | Prefer Intervals or internal model. |
| `training_effect` | real | Vendor-specific | Vendor-specific | Not standard. |
| `anaerobic_training_effect` | real | Vendor-specific | Vendor-specific | Not standard. |
| `avg_hr_bpm` | real | HR samples/session | HR samples/session | Derived if not summarized. |
| `max_hr_bpm` | real | HR samples/session | HR samples/session | Derived. |
| `avg_speed_mps` | real | `SpeedRecord` | `runningSpeed`, `cyclingSpeed`, workout samples | Direct/derived. |
| `avg_cadence_rpm` | real | `CyclingPedalingCadenceRecord`, `StepsCadenceRecord` | `cyclingCadence`, running cadence if available | Direct/derived. |
| `avg_power_w` | real | `PowerRecord` | `runningPower`, `cyclingPower` | Direct if recorded. |
| `functional_threshold_power_w` | real | Not standard | `cyclingFunctionalThresholdPower` | Apple direct; otherwise Intervals. |
| `normalized_power_w` | real | External/derived | External/derived | Intervals currently best source. |
| `intensity_factor` | real | External/derived | External/derived | Intervals or derive. |
| `ctl` | real | External/derived | External/derived | Intervals. |
| `atl` | real | External/derived | External/derived | Intervals. |
| `ramp_rate` | real | External/derived | External/derived | Intervals or derive. |

#### Nutrition

| Field | Type | Health Connect | Apple HealthKit | Notes |
| --- | --- | --- | --- | --- |
| `kcal_in` | real | `NutritionRecord.energy` | `dietaryEnergyConsumed` | Direct. |
| `protein_g` | real | `NutritionRecord.protein` | `dietaryProtein` | Direct. |
| `carbs_g` | real | `NutritionRecord.totalCarbohydrate` | `dietaryCarbohydrates` | Direct. |
| `fat_g` | real | `NutritionRecord.totalFat` | `dietaryFatTotal` | Direct. |
| `fiber_g` | real | `NutritionRecord.dietaryFiber` | `dietaryFiber` | Direct. |
| `sugar_g` | real | `NutritionRecord.sugar` | `dietarySugar` | Direct. |
| `cholesterol_mg` | real | `NutritionRecord.cholesterol` | `dietaryCholesterol` | Direct. |
| `water_ml` | real | `HydrationRecord` | `dietaryWater` | Direct. |
| `caffeine_mg` | real | `NutritionRecord.caffeine` | `dietaryCaffeine` | Direct. |
| `sodium_mg` | real | `NutritionRecord.sodium` | `dietarySodium` | Direct. |
| `potassium_mg` | real | `NutritionRecord.potassium` | `dietaryPotassium` | Direct. |
| `calcium_mg` | real | `NutritionRecord.calcium` | `dietaryCalcium` | Direct. |
| `iron_mg` | real | `NutritionRecord.iron` | `dietaryIron` | Direct. |
| `magnesium_mg` | real | `NutritionRecord.magnesium` | `dietaryMagnesium` | Direct. |
| `zinc_mg` | real | `NutritionRecord.zinc` | `dietaryZinc` | Direct. |
| `vitamin_a_mcg` | real | `NutritionRecord.vitaminA` | `dietaryVitaminA` | Direct. |
| `vitamin_b6_mg` | real | `NutritionRecord.vitaminB6` | `dietaryVitaminB6` | Direct. |
| `vitamin_b12_mcg` | real | `NutritionRecord.vitaminB12` | `dietaryVitaminB12` | Direct. |
| `vitamin_c_mg` | real | `NutritionRecord.vitaminC` | `dietaryVitaminC` | Direct. |
| `vitamin_d_mcg` | real | `NutritionRecord.vitaminD` | `dietaryVitaminD` | Direct. |
| `vitamin_e_mg` | real | `NutritionRecord.vitaminE` | `dietaryVitaminE` | Direct. |
| `vitamin_k_mcg` | real | `NutritionRecord.vitaminK` | `dietaryVitaminK` | Direct. |

Additional nutrition fields to preserve in `all_nutrients_json`:

- Biotin
- Chloride
- Chromium
- Copper
- Folate
- Folic acid
- Iodine
- Manganese
- Molybdenum
- Monounsaturated fat
- Niacin
- Pantothenic acid
- Phosphorus
- Polyunsaturated fat
- Riboflavin
- Saturated fat
- Selenium
- Thiamin
- Trans fat
- Unsaturated fat
- Meal name
- Meal type

## Platform Pull Inventory

### High Priority

These fields are needed to preserve existing coaching behavior.

- Sleep sessions and sleep stages.
- Steps.
- Active energy.
- Workout sessions.
- Workout distance.
- Workout duration.
- Workout activity type.
- Heart rate samples.
- Resting heart rate.
- HRV samples.
- Body weight.
- Body fat percentage.
- Lean body mass where available.
- Calories consumed.
- Protein.
- Carbohydrate.
- Fat.
- Fiber.
- Sugar.
- Cholesterol.
- Hydration/water.
- Cycling/running power where available.
- Cycling/running speed where available.
- Cycling/running cadence where available.
- VO2 max where available.

### Medium Priority

These improve recovery and body-composition reasoning but are not required for parity.

- Respiratory rate.
- Oxygen saturation.
- Body temperature.
- Basal body temperature.
- Blood pressure.
- Blood glucose.
- Height.
- Waist circumference.
- Bone mass.
- Body water.
- Basal energy.
- Total energy.
- Floors climbed.
- Elevation gain.
- Mindfulness sessions.
- Vitamins and minerals.

### Preserve If Present

These are vendor-specific, not platform-standard, but should be retained when an app writes them.

- Garmin body battery.
- Garmin stress score.
- Garmin HRV status.
- Garmin training effect.
- Garmin anaerobic training effect.
- Withings sleep score.
- Withings apnea index.
- Withings snoring fields.
- Withings breathing disturbance fields.
- Smart-scale visceral fat.
- Smart-scale metabolic age.
- Smart-scale physique rating.

## Non-Equivalent Fields And Gaps

| Current Field | Gap | Recommended Handling |
| --- | --- | --- |
| `training_load` | Not native to Health Connect or Apple Health. | Keep Intervals as primary or derive internal load from HR/power/pace/duration. |
| `body_battery_*` | Garmin proprietary readiness score. | Keep as vendor field if available; otherwise replace with derived readiness features, not a fake score. |
| `stress_avg` | Garmin proprietary stress score. | Preserve vendor value; otherwise derive separate stress proxy from HRV/RHR/sleep/load. |
| `hrv_status` | Garmin status label. | Preserve vendor value; otherwise derive status from personal baseline. |
| `sleep_score` | Vendor-specific. | Preserve when present; otherwise use explicit sleep duration/stage/efficiency signals. |
| `sleep_apnea_index` | Withings/vendor-specific. | Preserve only if available. Do not infer. |
| `normalized_power_w` | Not a generic Health Connect/HealthKit field. | Use Intervals or derive from power stream. |
| `ctl`, `atl`, `ramp_rate` | Not generic platform fields. | Use Intervals or derive in local model. |
| `visceral_fat`, `metabolic_age`, `physique_rating` | Smart-scale vendor outputs. | Store in metadata or explicit optional fields. |

## Derived Feature Spec

### Daily Rollup Rules

- Use athlete-local dates for daily assignment.
- Assign sleep to wake date, not sleep start date.
- Preserve source-specific raw fields before applying source priority.
- Do not treat missing samples as zero.
- For today, mark `data_completeness = partial`.
- Record source freshness for every domain.

### Sleep Derivations

- `sleep_seconds` is total non-awake sleep duration.
- `time_in_bed_seconds` is session duration or explicit in-bed duration.
- Stage totals are summed from sleep stage intervals.
- `sleep_efficiency = sleep_seconds / time_in_bed_seconds` when both are present.
- `sleep_latency_seconds`, `wakeup_count`, and `waso_seconds` should only be derived if stage timestamps support them.

### HRV Derivations

- Keep RMSSD and SDNN separate in metadata.
- Do not compare Health Connect RMSSD and Apple SDNN as identical values.
- Build source-specific baselines first.
- Only create a platform-neutral HRV status after there is enough baseline data.

### Training Derivations

- Bucket workouts by source type/name into `run`, `ride`, `strength`, `swim`, `walk`, and `other`.
- Use workout sessions as canonical for session count.
- Use streams to derive HR, speed, cadence, and power summaries when source summaries are absent.
- Use Intervals.icu for training load, CTL, ATL, ramp rate, normalized watts, eFTP, and power-duration bests until a local model replaces it.

### Nutrition Derivations

- Recompute daily totals from source nutrition events each run.
- Sum numeric nutrients by local date.
- Preserve all unsupported nutrients in `all_nutrients_json`.
- Push only calories, carbs, protein, and fat to Intervals unless the Intervals payload is expanded.

## AI-Facing Current State Contract

`current_state.json` should continue to expose:

- `generated_at`
- `last_sync`
- `latest_available_dates`
- `current_capacity`
- `current_activity`
- `current_recovery`
- `current_cycling_power`
- `current_nutrition_context`
- `coach_flags`
- `source_coverage`

The source names can change, but the semantics should remain stable.

## Migration Plan

1. Add Health Connect / HealthKit ingestion into `health_samples`, `sleep_sessions`, `workouts`, and `nutrition_daily`.
2. Keep existing Garmin, Withings, Health Sync, and Intervals paths running until field parity is verified.
3. Modify `build_daily_metrics.py` to read from canonical platform-neutral tables instead of GarminDB-specific tables.
4. Preserve current source-specific columns during transition for debugging.
5. Add source-quality and source-priority metadata to avoid silent source swaps.
6. Rebuild `athlete_capacity_profile.json` from platform-neutral workouts and daily metrics.
7. Keep Intervals integration for training load and cycling power until local derivations are validated.
8. Retire Garmin-specific fallback rules only after Health Connect / Apple Health coverage is stable for sleep, HRV, resting HR, steps, active energy, workouts, and body metrics.

## Acceptance Criteria

- `daily_metrics` can be generated without direct GarminDB dependency.
- Current 90d and 365d capacity windows match prior Garmin-derived outputs within expected source differences.
- Sleep, steps, active energy, resting HR, HRV, weight, workouts, and nutrition all preserve source metadata.
- HRV method differences are explicit.
- Training load is either sourced from Intervals or clearly marked as unavailable/derived.
- AI prompts continue to receive the same conceptual fields and guardrails.
- Vendor-only metrics are never fabricated from generic platform data.
