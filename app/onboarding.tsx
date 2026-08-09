import React, { useState, useRef } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Dimensions, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { StorageService } from '@/services/storageService';
import { SafeButton } from '@/components/ui/SafeButton';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    image: null,
    bgColor: Colors.primarySurface,
    title: 'One-Tap SOS',
    subtitle: 'Trigger emergency alerts instantly. Hold the SOS button for 3 seconds to notify all your trusted contacts with your live location.',
    icon: 'warning' as const,
    color: Colors.primary,
  },
  {
    image: require('@/assets/images/onboarding2.png'),
    bgColor: Colors.secondarySurface,
    title: 'Live Location Sharing',
    subtitle: 'Share your real-time GPS location with trusted contacts. Monitor your safe arrival and set geofence alerts for loved ones.',
    icon: 'location-on' as const,
    color: Colors.secondary,
  },
  {
    image: null,
    bgColor: Colors.successSurface,
    title: 'Family Safety Circle',
    subtitle: 'Keep your entire family protected. Set up a safety network, monitor journeys, and receive instant alerts when needed.',
    icon: 'people' as const,
    color: Colors.success,
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const handleScroll = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    setActiveIndex(idx);
  };

  const handleNext = () => {
    if (activeIndex < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: width * (activeIndex + 1), animated: true });
    } else {
      handleGetStarted();
    }
  };

  const handleGetStarted = async () => {
    await StorageService.setOnboarded();
    router.replace('/auth/login');
  };

  return (
    <View style={styles.container}>
      <Pressable style={styles.skipBtn} onPress={handleGetStarted}>
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
      >
        {SLIDES.map((slide, index) => (
          <View key={index} style={[styles.slide, { width }]}>
            <View style={[styles.imageContainer, { backgroundColor: slide.bgColor }]}>
              {slide.image ? (
                <>
                  <Image source={slide.image} style={styles.image} contentFit="cover" />
                  <View style={styles.imageOverlay} />
                </>
              ) : (
                <View style={styles.iconPlaceholder}>
                  <MaterialIcons name={slide.icon} size={100} color={slide.color} />
                </View>
              )}
              <View style={[styles.iconBadge, { backgroundColor: slide.color }]}>
                <MaterialIcons name={slide.icon} size={28} color="#fff" />
              </View>
            </View>
            <View style={styles.content}>
              <Text style={styles.title}>{slide.title}</Text>
              <Text style={styles.subtitle}>{slide.subtitle}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
          ))}
        </View>
        <SafeButton
          label={activeIndex === SLIDES.length - 1 ? 'Get Started' : 'Next'}
          onPress={handleNext}
          variant="primary"
          size="lg"
          fullWidth
          style={styles.nextBtn}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  skipBtn: { position: 'absolute', top: Platform.OS === 'ios' ? 56 : 32, right: Spacing.base, zIndex: 10, padding: Spacing.sm },
  skipText: { ...Typography.body, color: Colors.textSecondary, fontWeight: '600' },
  slide: { flex: 1 },
  imageContainer: { height: '52%', position: 'relative', alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' },
  iconPlaceholder: { ...StyleSheet.absoluteFillObject as any, alignItems: 'center', justifyContent: 'center', opacity: 0.5 },
  image: { ...StyleSheet.absoluteFillObject },
  imageOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.15)' },
  iconBadge: {
    position: 'absolute', bottom: -24, width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 8,
    borderWidth: 3, borderColor: '#fff',
  },
  content: { flex: 1, paddingHorizontal: Spacing.xxl, paddingTop: Spacing.xxxl, alignItems: 'center' },
  title: { ...Typography.h1, color: Colors.text, textAlign: 'center', marginBottom: Spacing.md },
  subtitle: { ...Typography.bodyLarge, color: Colors.textSecondary, textAlign: 'center', lineHeight: 26 },
  footer: { paddingHorizontal: Spacing.xl, paddingBottom: Platform.OS === 'ios' ? 48 : 32, paddingTop: Spacing.base },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm, marginBottom: Spacing.lg },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  dotActive: { width: 24, backgroundColor: Colors.primary },
  nextBtn: {},
});
