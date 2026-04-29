import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { availabilityForTypes } from '../core/metricAvailability';
import { AnalyticsPanel, AnalyticsScreen } from '../screens/AnalyticsScreen';
import { CoachOnboardingScreen } from '../screens/CoachOnboardingScreen';
import { CoachScreen } from '../screens/CoachScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { SourceScreen } from '../screens/SourceScreen';
import { WorkoutPlanScreen } from '../screens/WorkoutPlanScreen';
import { DataCard, SmallMetric } from '../ui/primitives';
import { TabBar } from '../ui/TabBar';

describe('app module structure', () => {
  it('exports the extracted screen and navigation components', () => {
    expect(typeof CoachScreen).toBe('function');
    expect(typeof CoachOnboardingScreen).toBe('function');
    expect(typeof WorkoutPlanScreen).toBe('function');
    expect(typeof AnalyticsPanel).toBe('function');
    expect(typeof AnalyticsScreen).toBe('function');
    expect(typeof HistoryScreen).toBe('function');
    expect(typeof SourceScreen).toBe('function');
    expect(typeof TabBar).toBe('function');
  });

  it('renders shared UI primitives after extraction', () => {
    render(
      <DataCard label="Recovery">
        <SmallMetric label="Sleep" value="7h" />
        <Text>Ready</Text>
      </DataCard>,
    );

    expect(screen.getByText('Recovery')).toBeOnTheScreen();
    expect(screen.getByText('Sleep')).toBeOnTheScreen();
    expect(screen.getByText('7h')).toBeOnTheScreen();
    expect(screen.getByText('Ready')).toBeOnTheScreen();
  });

  it('keeps analytics embedded in the You tab instead of a separate tab', () => {
    render(<TabBar active="coach" onChange={jest.fn()} />);

    expect(screen.getByText('You')).toBeOnTheScreen();
    expect(screen.queryByText('Analytics')).toBeNull();
  });

  it('combines availability across related metric types', () => {
    const availability = availabilityForTypes(
      [
        {
          canonicalType: 'steps',
          sampleCount: 10,
          dayCount: 2,
          latestDate: '2026-04-27',
        },
        {
          canonicalType: 'distance',
          sampleCount: 7,
          dayCount: 4,
          latestDate: '2026-04-29',
        },
        {
          canonicalType: 'sleep_session',
          sampleCount: 3,
          dayCount: 1,
          latestDate: '2026-04-28',
        },
      ],
      ['steps', 'distance'],
    );

    expect(availability).toEqual({
      canonicalType: 'steps',
      sampleCount: 17,
      dayCount: 4,
      latestDate: '2026-04-29',
    });
  });
});
