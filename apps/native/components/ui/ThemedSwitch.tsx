import { Switch, type SwitchProps } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function ThemedSwitch(props: SwitchProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const isOn = Boolean(props.value);
  const trackOff = colorScheme === 'dark' ? '#475569' : palette.border;
  const trackOn = palette.tint;
  const thumbOn = '#FFFFFF';
  const thumbOff = colorScheme === 'dark' ? '#F8FAFC' : '#FFFFFF';

  return (
    <Switch
      {...props}
      trackColor={{ false: trackOff, true: trackOn }}
      thumbColor={isOn ? thumbOn : thumbOff}
      ios_backgroundColor={trackOff}
    />
  );
}
