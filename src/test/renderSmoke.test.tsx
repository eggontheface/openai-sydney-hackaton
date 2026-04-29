import { render, screen } from '@testing-library/react-native';
import { Text, View } from 'react-native';

function SmokeView() {
  return (
    <View>
      <Text>Coach testing foundation ready</Text>
    </View>
  );
}

describe('React Native testing setup', () => {
  it('renders a native component tree', () => {
    render(<SmokeView />);

    expect(screen.getByText('Coach testing foundation ready')).toBeOnTheScreen();
  });
});
