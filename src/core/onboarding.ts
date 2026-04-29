export function resolveOnboardingEvent(goal: string) {
  const text = goal.toLowerCase();

  if (text.includes('hyrox')) {
    return {
      name: 'BYD HYROX Sydney',
      date: '1-5 July 2026',
      location: 'Sydney Showground, Sydney Olympic Park, NSW',
      confidence: 'verified',
      source: 'internal event database',
    };
  }

  return null;
}
