import { useColorScheme as useSystemColorScheme } from 'react-native';

import { useThemePreference } from '@/lib/theme/ThemePreferenceProvider';

export function useColorScheme() {
  const systemScheme = useSystemColorScheme();
  const theme = useThemePreference();
  if (theme?.resolvedScheme) {
    return theme.resolvedScheme;
  }
  return systemScheme;
}
