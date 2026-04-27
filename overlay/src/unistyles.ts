import { StyleSheet } from 'react-native-unistyles';

const lightTheme = {
  colors: {
    background: '#FFFFFF',
    text: '#1B140C',
    primary: '#007AFF',
  },
  gap: (v: number) => v * 8,
} as const;

const breakpoints = {
  xs: 0,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
} as const;

type AppThemes = {
  light: typeof lightTheme;
};
type AppBreakpoints = typeof breakpoints;

declare module 'react-native-unistyles' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface UnistylesThemes extends AppThemes {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface UnistylesBreakpoints extends AppBreakpoints {}
}

StyleSheet.configure({
  themes: {
    light: lightTheme,
  },
  breakpoints,
  settings: {
    initialTheme: 'light',
  },
});
