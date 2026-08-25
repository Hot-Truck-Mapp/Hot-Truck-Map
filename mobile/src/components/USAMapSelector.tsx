import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Text as SvgText } from 'react-native-svg';
import { US_MAP_VIEWBOX, US_STATE_PATHS, US_STATE_LABEL_POS, DC_MARKER } from '@shared/us-map-paths';

type Props = {
  /** Called with the 2-letter state code when a state is tapped. */
  onSelect: (code: string) => void;
};

const [, , VB_WIDTH, VB_HEIGHT] = US_MAP_VIEWBOX.split(' ').map(Number);

/** Clickable illustrated map of the US — lets customers tap any state to
 * jump to its festivals/events screen. Path data lives in lib/us-map-paths.ts
 * (shared with the web app's equivalent map via the @shared alias). */
export function USAMapSelector({ onSelect }: Props) {
  const [pressed, setPressed] = useState<string | null>(null);

  return (
    <View style={styles.wrap}>
      <Svg viewBox={US_MAP_VIEWBOX} style={{ width: '100%', aspectRatio: VB_WIDTH / VB_HEIGHT }}>
        {Object.entries(US_STATE_PATHS).map(([code, d]) => (
          <Path
            key={code}
            d={d}
            fill={pressed === code ? '#E8481C' : '#D3D3D3'}
            stroke="#ffffff"
            strokeWidth={1}
            onPressIn={() => setPressed(code)}
            onPressOut={() => setPressed((c) => (c === code ? null : c))}
            onPress={() => onSelect(code)}
          />
        ))}
        {/* DC — too small at this scale for a path, rendered as a dot */}
        <Circle
          cx={DC_MARKER.cx}
          cy={DC_MARKER.cy}
          r={DC_MARKER.r}
          fill={pressed === 'DC' ? '#E8481C' : '#888888'}
          stroke="#ffffff"
          strokeWidth={1.5}
          onPressIn={() => setPressed('DC')}
          onPressOut={() => setPressed((c) => (c === 'DC' ? null : c))}
          onPress={() => onSelect('DC')}
        />

        {/* State abbreviation labels — decorative, taps fall through to the shape beneath */}
        {Object.entries(US_STATE_LABEL_POS).map(([code, pos]) => (
          <SvgText
            key={code}
            x={pos.x}
            y={pos.y}
            textAnchor="middle"
            fontSize={9}
            fontWeight="700"
            fill={pressed === code ? '#ffffff' : '#5a5a5a'}
            pointerEvents="none"
          >
            {code}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
});
