import { Dimensions } from 'react-native';

const BASE_WIDTH = 375; // iPhone SE / 4.7" baseline
const MAX_SCALE  = 1.15; // cap growth at 15% above base

/**
 * Scales a font size proportionally to the device's screen width.
 *
 * On a 375pt-wide device (iPhone SE) the value is returned unchanged.
 * On wider devices (iPhone Pro Max, Plus) the value grows up to MAX_SCALE.
 * Use this for titles and prominent text that should feel proportional
 * to the screen. For small labels and status badges, use a fixed size
 * and set maxFontSizeMultiplier={1.2} on the Text element instead.
 *
 * Called at module load time — safe for portrait-only apps because
 * the window width does not change orientation.
 */
export function scaleFont(size: number): number {
  const { width } = Dimensions.get('window');
  const scale = Math.min(width / BASE_WIDTH, MAX_SCALE);
  return Math.round(size * scale);
}
