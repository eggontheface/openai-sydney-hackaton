import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { MessageCircle, RefreshCw } from "lucide-react-native";

import { styles } from "../styles/appStyles";
import { tokens } from "../theme/tokens";
import { CoachAvatar } from "../ui/primitives";

export function SplashScreen({
  busy,
  onStartOnboarding,
  onSyncAndStart,
  sourceLabel,
  status,
}: {
  busy: boolean;
  onStartOnboarding: () => void;
  onSyncAndStart: () => void;
  sourceLabel: string;
  status: string;
}) {
  return (
    <View style={styles.splashScreen}>
      <View style={styles.splashHeader}>
        <CoachAvatar size={44} />
        <Text style={styles.splashTitle}>BioStream</Text>
        <Text style={styles.splashCopy}>Choose how you want to start.</Text>
      </View>

      <View style={styles.splashActions}>
        <Pressable
          accessibilityRole="button"
          onPress={onStartOnboarding}
          style={({ pressed }) => [
            styles.splashOption,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.splashOptionIcon}>
            <MessageCircle color={tokens.accent} size={20} strokeWidth={2.2} />
          </View>
          <View style={styles.splashOptionCopy}>
            <Text style={styles.splashOptionTitle}>Onboarding</Text>
            <Text style={styles.splashOptionText}>
              Set goals, constraints, and data preferences first.
            </Text>
          </View>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onSyncAndStart}
          style={({ pressed }) => [
            styles.splashOption,
            styles.splashOptionPrimary,
            busy && styles.disabled,
            pressed && !busy && styles.pressed,
          ]}
        >
          <View
            style={[styles.splashOptionIcon, styles.splashOptionIconPrimary]}
          >
            {busy ? (
              <ActivityIndicator color={tokens.surface} size="small" />
            ) : (
              <RefreshCw color={tokens.surface} size={20} strokeWidth={2.2} />
            )}
          </View>
          <View style={styles.splashOptionCopy}>
            <Text
              style={[
                styles.splashOptionTitle,
                styles.splashOptionTitlePrimary,
              ]}
            >
              Sync data & start
            </Text>
            <Text
              style={[styles.splashOptionText, styles.splashOptionTextPrimary]}
            >
              {busy ? status : "Connect data, then open Coach."}
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

export function StartLoadingScreen({
  sourceLabel,
  status,
}: {
  sourceLabel: string;
  status: string;
}) {
  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <CoachAvatar size={32} />
          <View>
            <Text style={styles.topTitle}>Coach</Text>
            <Text style={styles.topMeta}>Loading health data</Text>
          </View>
        </View>
      </View>

      <View style={styles.startLoadingContent}>
        <ActivityIndicator color={tokens.accent} size="large" />
        <Text style={styles.startLoadingTitle}>Loading</Text>
        <Text style={styles.startLoadingText}>
          {status || `Getting recent data from ${sourceLabel}.`}
        </Text>
      </View>
    </View>
  );
}
