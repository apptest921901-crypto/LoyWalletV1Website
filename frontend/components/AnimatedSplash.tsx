import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions, Image, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';

const { width, height } = Dimensions.get('window');

interface Props {
  onComplete: () => void;
}

const LoyaltyCardGraphic = ({ style, color }: { style: any, color: string }) => (
  <Animated.View style={[styles.card, { backgroundColor: color }, style]}>
    <View style={styles.cardHeader}>
      <View style={styles.cardLogoCircle} />
      <View style={styles.cardTextLine} />
    </View>
    <View style={styles.cardBarcodeContainer}>
      <View style={[styles.barcodeLine, { width: '20%' }]} />
      <View style={[styles.barcodeLine, { width: '10%' }]} />
      <View style={[styles.barcodeLine, { width: '30%' }]} />
      <View style={[styles.barcodeLine, { width: '15%' }]} />
    </View>
  </Animated.View>
);

export default function AnimatedSplash({ onComplete }: Props) {
  const walletScale = useRef(new Animated.Value(0)).current;
  const walletTranslateY = useRef(new Animated.Value(0)).current;
  const walletRotateY = useRef(new Animated.Value(0)).current;
  const walletOpacity = useRef(new Animated.Value(1)).current;
  
  const card1Pos = useRef(new Animated.ValueXY({ x: -width/2, y: -height })).current;
  const card2Pos = useRef(new Animated.ValueXY({ x: 0, y: -height })).current;
  const card3Pos = useRef(new Animated.ValueXY({ x: width/2, y: -height })).current;
  const cardsOpacity = useRef(new Animated.Value(0)).current;
  
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.5)).current;
  const brandOpacity = useRef(new Animated.Value(0)).current;
  const brandTranslateY = useRef(new Animated.Value(20)).current;
  
  const ctaOpacity = useRef(new Animated.Value(0)).current;
  const ctaPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 1. MAIN ANIMATION SEQUENCE
    Animated.sequence([
      // A. Wallet Entrance
      Animated.spring(walletScale, { toValue: 1, useNativeDriver: true, tension: 40, friction: 7 }),
      
      // B. Cards Convergence
      Animated.parallel([
        Animated.timing(cardsOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.stagger(150, [
          Animated.spring(card1Pos, { toValue: { x: -25, y: -25 }, useNativeDriver: true, tension: 20, friction: 8 }),
          Animated.spring(card2Pos, { toValue: { x: 0, y: -35 }, useNativeDriver: true, tension: 20, friction: 8 }),
          Animated.spring(card3Pos, { toValue: { x: 25, y: -25 }, useNativeDriver: true, tension: 20, friction: 8 }),
        ]),
      ]),

      // C. Wallet Impact
      Animated.parallel([
        Animated.sequence([
          Animated.timing(walletTranslateY, { toValue: 10, duration: 100, useNativeDriver: true }),
          Animated.spring(walletTranslateY, { toValue: 0, useNativeDriver: true, bounciness: 15 }),
        ]),
        Animated.timing(card1Pos.y, { toValue: 15, duration: 400, useNativeDriver: true }),
        Animated.timing(card2Pos.y, { toValue: 10, duration: 500, useNativeDriver: true }),
        Animated.timing(card3Pos.y, { toValue: 15, duration: 600, useNativeDriver: true }),
      ]),

      // D. Transformation
      Animated.delay(600),
      Animated.parallel([
        Animated.timing(walletRotateY, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(walletOpacity, { toValue: 0, duration: 700, useNativeDriver: true }),
        Animated.timing(walletScale, { toValue: 0.2, duration: 900, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(400),
          Animated.parallel([
            Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
            Animated.spring(logoScale, { toValue: 1, useNativeDriver: true, bounciness: 10 }),
          ]),
        ]),
      ]),

      // E. Brand Reveal
      Animated.parallel([
        Animated.timing(brandOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(brandTranslateY, { toValue: 0, useNativeDriver: true, tension: 40 }),
      ]),

      // F. Reveal CTA (But don't block the sequence here!)
      Animated.timing(ctaOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      
      // G. Final Pause before entering app
      Animated.delay(800),
    ]).start(() => {
      onComplete();
    });

    // 2. INDEPENDENT PULSE LOOP (Doesn't block onComplete)
    Animated.loop(
      Animated.sequence([
        Animated.timing(ctaPulse, { toValue: 1.08, duration: 800, useNativeDriver: true }),
        Animated.timing(ctaPulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();

  }, [onComplete]);

  const flip = walletRotateY.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <Animated.View style={[
        styles.groupContainer, 
        { transform: [{ scale: walletScale }, { rotateY: flip }, { translateY: walletTranslateY }], opacity: walletOpacity }
      ]}>
        <View style={styles.walletBack} />
        <Animated.View style={{ opacity: cardsOpacity, position: 'absolute', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
          <LoyaltyCardGraphic color="#FFD700" style={{ transform: [{ translateX: card1Pos.x }, { translateY: card1Pos.y }, { rotate: '-12deg' }], zIndex: 5 }} />
          <LoyaltyCardGraphic color="#007AFF" style={{ transform: [{ translateX: card2Pos.x }, { translateY: card2Pos.y }, { rotate: '0deg' }], zIndex: 4 }} />
          <LoyaltyCardGraphic color="#E5E5EA" style={{ transform: [{ translateX: card3Pos.x }, { translateY: card3Pos.y }, { rotate: '12deg' }], zIndex: 3 }} />
        </Animated.View>
        <View style={styles.walletFront}>
          <View style={styles.walletStitching} />
          <View style={styles.walletClasp}><View style={styles.goldButton} /></View>
        </View>
      </Animated.View>

      <View style={styles.logoPosition}>
        <Animated.Image 
          source={{ uri: 'https://customer-assets.emergentagent.com/job_lovaltyorganizer/artifacts/cn1jsy8n_Logo%203%20circle.png' }}
          style={[styles.logo, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}
          resizeMode="contain"
        />
        <Animated.View style={{ opacity: brandOpacity, transform: [{ translateY: brandTranslateY }], alignItems: 'center' }}>
          <Text style={styles.brandName}>LoyWallet</Text>
          <Text style={styles.tagline}>Wallet for all your loyalty cards</Text>
        </Animated.View>
      </View>

      <Animated.View style={[styles.ctaContainer, { opacity: ctaOpacity, transform: [{ scale: ctaPulse }] }]}>
        <Text style={styles.ctaText}>GET STARTED</Text>
        <View style={styles.ctaUnderline} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FB', justifyContent: 'center', alignItems: 'center' },
  groupContainer: { width: 200, height: 140, justifyContent: 'center', alignItems: 'center', position: 'absolute' },
  card: { position: 'absolute', width: 110, height: 70, borderRadius: 8, padding: 8, elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 5 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardLogoCircle: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.5)' },
  cardTextLine: { width: 25, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  cardBarcodeContainer: { flexDirection: 'row', gap: 2, position: 'absolute', bottom: 8, left: 8 },
  barcodeLine: { height: 10, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 1 },
  walletBack: { position: 'absolute', width: 180, height: 120, backgroundColor: '#2D1E17', borderRadius: 15, zIndex: 0 },
  walletFront: { position: 'absolute', bottom: 0, width: 180, height: 80, backgroundColor: '#4A3228', borderBottomLeftRadius: 15, borderBottomRightRadius: 15, zIndex: 20, justifyContent: 'center' },
  walletStitching: { position: 'absolute', top: 5, left: 10, right: 10, bottom: 10, borderStyle: 'dashed', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', borderRadius: 10 },
  walletClasp: { position: 'absolute', top: -15, right: 30, width: 35, height: 45, backgroundColor: '#3D2B1F', borderRadius: 6, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 8 },
  goldButton: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#DAA520', borderWidth: 1, borderColor: '#B8860B' },
  logoPosition: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  logo: { width: 150, height: 150 },
  brandName: { fontSize: 42, fontWeight: '900', color: '#1A1A1A', marginTop: 15, letterSpacing: -1.5 },
  tagline: { fontSize: 15, fontWeight: '700', color: '#8E8E93', marginTop: 5 },
  ctaContainer: { position: 'absolute', bottom: 60, alignItems: 'center' },
  ctaText: { fontSize: 14, fontWeight: '800', color: '#007AFF', letterSpacing: 3 },
  ctaUnderline: { width: 30, height: 3, backgroundColor: '#007AFF', marginTop: 6, borderRadius: 2 }
});
