import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SLIDES = [
  {
    emoji: '🗺️',
    title: 'Find Food Trucks Near You',
    description:
      "See every food truck open right now on a live map. Filter by cuisine, location, or what's trending today.",
  },
  {
    emoji: '❤️',
    title: 'Follow Your Favorites',
    description:
      'Save your favorite trucks and get notified the moment they go live. Never miss a taco again.',
  },
  {
    emoji: '⚡',
    title: 'Order Ahead',
    description:
      "Skip the line — place your order before you arrive and pick it up when it's ready. Pay at the truck.",
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setCurrentIndex(index);
  }

  function goToNext() {
    if (currentIndex < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: SCREEN_WIDTH * (currentIndex + 1), animated: true });
    } else {
      handleGetStarted();
    }
  }

  async function handleGetStarted() {
    try {
      await SecureStore.setItemAsync('onboarding_complete', 'true');
    } catch {
      // SecureStore unavailable — proceed anyway
    }
    router.replace('/(tabs)');
  }

  const isLast = currentIndex === SLIDES.length - 1;

  return (
    <View style={styles.container}>
      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        {SLIDES.map((slide, index) => (
          <View key={index} style={[styles.slide, { width: SCREEN_WIDTH }]}>
            {/* Illustration area */}
            <View style={styles.illustrationContainer}>
              <Text style={styles.emoji}>{slide.emoji}</Text>
            </View>

            {/* Text */}
            <View style={styles.textContainer}>
              <Text style={styles.title}>{slide.title}</Text>
              <Text style={styles.description}>{slide.description}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Bottom controls */}
      <View style={styles.bottomContainer}>
        {/* Dot indicators */}
        <View style={styles.dotsContainer}>
          {SLIDES.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentIndex ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>

        {/* CTA Button */}
        <TouchableOpacity
          style={styles.button}
          onPress={goToNext}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>
            {isLast ? 'Get Started' : 'Next'}
          </Text>
        </TouchableOpacity>

        {/* Skip link (hidden on last slide) */}
        {!isLast && (
          <TouchableOpacity onPress={handleGetStarted} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollView: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
    paddingBottom: 20,
  },
  illustrationContainer: {
    width: 160,
    height: 160,
    borderRadius: 48,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 48,
  },
  emoji: {
    fontSize: 72,
  },
  textContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 15,
    color: '#a3a3a3',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  bottomContainer: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    paddingTop: 24,
    alignItems: 'center',
    gap: 16,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 24,
    backgroundColor: '#E8481C',
  },
  dotInactive: {
    width: 8,
    backgroundColor: '#333333',
  },
  button: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#E8481C',
    alignItems: 'center',
    shadowColor: '#E8481C',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipText: {
    color: '#525252',
    fontSize: 14,
    fontWeight: '600',
  },
});
