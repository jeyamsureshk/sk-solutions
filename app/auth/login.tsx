import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Dimensions,
  StatusBar,
  Keyboard,
  ImageBackground,
  Image,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

const { width, height } = Dimensions.get('window');

// --- ASSETS ---
const BG_IMAGE = { uri: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2670&auto=format&fit=crop' };
const LOGO_IMAGE = require('@/assets/images/logo.png'); 

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // Load saved data & Start Animation
  useEffect(() => {
    const loadSavedData = async () => {
      try {
        const savedEmail = await AsyncStorage.getItem('userEmail');
        const savedPassword = await AsyncStorage.getItem('userPassword');
        if (savedEmail) setEmail(savedEmail);
        if (savedPassword) setPassword(savedPassword);
      } catch (err) {
        console.error('Error loading saved login data:', err);
      }
    };
    loadSavedData();

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleLogin = async () => {
    Keyboard.dismiss();
    if (!email || !password) {
      Alert.alert('Missing Info', 'Please fill in both email and password.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        Alert.alert('Login Failed', error.message);
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('profiles').upsert({
            id: user.id,
            operator_id: user.user_metadata?.operator_id || null,
            full_name: user.user_metadata?.full_name || '',
            email: user.email,
          });

          await AsyncStorage.setItem('userEmail', email);
          await AsyncStorage.setItem('userPassword', password);
          await AsyncStorage.setItem('userId', user.id);
        }
        router.replace('/(tabs)');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      <ImageBackground source={BG_IMAGE} style={styles.backgroundImage} resizeMode="cover">
        
        {/* Dark Slate Overlay */}
        <LinearGradient
          colors={['rgba(15, 23, 42, 0.85)', 'rgba(30, 27, 75, 0.95)']}
          style={StyleSheet.absoluteFill}
        />

        <KeyboardAwareScrollView
          contentContainerStyle={styles.scrollContent}
          enableOnAndroid
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View 
            style={[
              styles.contentWrapper, 
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
            ]}
          >
            {/* --- HEADER SECTION --- */}
            <View style={styles.header}>
              <View style={styles.logoContainer}>
                <Image 
                  source={LOGO_IMAGE} 
                  style={styles.logoImage} 
                  resizeMode="contain" 
                />
              </View>
              <Text style={styles.title1}>
                SK Solutions <Text style={[styles.title, { fontWeight: '300' }]}>Global</Text>
              </Text>
              <Text style={styles.subtitle}>Production Intelligence Portal</Text>
            </View>

            {/* --- LOGIN CARD --- */}
            <View style={styles.glassCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Login</Text>
                <View style={styles.activeDot} />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>EMAIL</Text>
                <View style={styles.inputContainer}>
                  <Feather name="user" size={18} color="#94a3b8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter corporate email"
                    placeholderTextColor="#64748b"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>PASSWORD</Text>
                <View style={styles.inputContainer}>
                  <Feather name="lock" size={18} color="#94a3b8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••••••"
                    placeholderTextColor="#64748b"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                  />
                </View>
              </View>

              <TouchableOpacity 
                activeOpacity={0.9}
                onPress={handleLogin} 
                disabled={loading}
                style={styles.buttonShadow}
              >
                <LinearGradient
                  colors={['#3b82f6', '#2563eb']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.button}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <View style={styles.buttonContent}>
                      <Text style={styles.buttonText}>ACCESS PORTAL</Text>
                      <Feather name="wifi" size={18} color="#fff" style={{marginLeft: 8}}/>
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.footer}>
                <TouchableOpacity onPress={() => router.push('/auth/signup')}>
                  <Text style={styles.footerLink}>Register New Device</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.versionText}>v2.0.4 • Enterprise Edition</Text>
            <Text style={styles.authText}>© 2026 SK Solutions</Text>

          </Animated.View>
        </KeyboardAwareScrollView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  backgroundImage: { flex: 1, width: '100%', height: '100%' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  contentWrapper: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  
  // Floating Logo Styles
  header: { alignItems: 'center', marginBottom: 40 },
  logoContainer: {
    width: 140, // Significantly larger footprint
    height: 140,
    backgroundColor: 'transparent', // No background box
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    // Soft Blue Glow
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 25,
    elevation: 15,
  },
  logoImage: { 
    width: '100%', 
    height: '100%' 
  },
  title1: { 
    fontSize: 28, 
    fontWeight: '900', 
    color: '#fff', 
    letterSpacing: 1.5, 
    marginBottom: 4,
    marginTop: -10 // Pull text closer to floating logo
  },
  title: { fontWeight: '300' },
  subtitle: { fontSize: 12, color: '#94a3b8', letterSpacing: 1.5, fontWeight: '600', textTransform: 'uppercase' },

  // Card Styles
  glassCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 32,
    padding: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.6,
    shadowRadius: 40,
    elevation: 12,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
  cardTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ade80', shadowColor: '#4ade80', shadowRadius: 5 },

  inputGroup: { marginBottom: 22 },
  label: { fontSize: 10, fontWeight: '800', color: '#64748b', marginBottom: 10, letterSpacing: 1 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(2, 6, 23, 0.6)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    height: 56,
    paddingHorizontal: 18,
  },
  inputIcon: { marginRight: 14 },
  input: { flex: 1, fontSize: 15, color: '#fff', fontWeight: '500' },

  buttonShadow: { marginTop: 10, marginBottom: 24, shadowColor: '#3b82f6', shadowOpacity: 0.5, shadowRadius: 20, elevation: 10 },
  button: { height: 60, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  buttonContent: { flexDirection: 'row', alignItems: 'center' },
  buttonText: { fontSize: 15, fontWeight: '800', color: '#fff', letterSpacing: 1.5 },

  footer: { alignItems: 'center' },
  footerLink: { color: '#94a3b8', fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  versionText: { textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 11, marginTop: 40, fontWeight: '600' },
  authText: { textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 11, marginTop: 4, fontWeight: '600' },
});
