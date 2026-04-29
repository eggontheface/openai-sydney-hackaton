import { Platform, Pressable, Text, View } from 'react-native';
import { Dumbbell, History, Sparkles, User, type LucideIcon } from 'lucide-react-native';

import type { Tab } from '../core/types';
import { styles } from '../styles/appStyles';
import { tokens } from '../theme/tokens';

const androidGestureInset = Platform.OS === 'android' ? 14 : 0;

export function TabBar({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  const tabs: { id: Tab; label: string; icon: LucideIcon }[] = [
    { id: 'coach', label: 'Coach', icon: Sparkles },
    { id: 'workout', label: 'Workout', icon: Dumbbell },
    { id: 'history', label: 'History', icon: History },
    { id: 'you', label: 'You', icon: User },
  ];

  return (
    <View style={[styles.tabBar, androidGestureInset > 0 && { paddingBottom: 5 + androidGestureInset }]}>
      {tabs.map((tab) => {
        const activeTab = active === tab.id;
        const Icon = tab.icon;

        return (
          <Pressable
            accessibilityRole="button"
            key={tab.id}
            onPress={() => onChange(tab.id)}
            style={styles.tabItem}
          >
            <Icon
              color={activeTab ? tokens.ink : tokens.muted}
              size={23}
              strokeWidth={activeTab ? 2.2 : 1.8}
            />
            <Text style={[styles.tabText, activeTab && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
