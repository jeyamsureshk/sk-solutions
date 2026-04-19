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
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useOperators } from '@/hooks/useOperators';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

const { width } = Dimensions.get('window');

// Matching High-Res Tech Background
const BG_IMAGE = { uri: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2670&auto=format&fit=crop' };
// Asset Logo
const LOGO_IMAGE = require('@/assets/images/logo.png');

export default function SignupScreen() {
  const [id, setId] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingName, setFetchingName] = useState(false);
  
  const router = useRouter();
  const { fetchOperatorById } = useOperators();

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    // Start Entrance Animation
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

  // Auto-fill Logic
  useEffect(() => {
    const fetchName = async () => {
      if (id.trim().length > 0) {
        setFetchingName(true);
        const operatorData = await fetchOperatorById(parseInt(id));
        if (operatorData) {
          setFullName(operatorData.name);
          setEmail(operatorData.email);
        } else {
          setFullName('');
          setEmail('');
        }
        setFetchingName(false);
      } else {
        setFullName('');
        setEmail('');
      }
    };
    
    const timeoutId = setTimeout(() => {
        if(id) fetchName();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [id, fetchOperatorById]);

  const handleSignup = async () => {
    Keyboard.dismiss();
    if (!id || !fullName || !email || !password || !confirmPassword) {
      Alert.alert('Missing Info', 'Please ensure all fields are filled.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Security Alert', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            operator_id: id,
            full_name: fullName,
          },
        },
      });

      if (error) {
        let msg = error.message;
        if (msg.toLowerCase().includes('already registered')) msg = 'User already registered.';
        Alert.alert('Registration Failed', msg);
        return;
      }

      if (data.user) {
        Alert.alert('Success', 'Device registered successfully. Please login.');
        router.replace('/auth/login');
      }
    } catch (err) {
      Alert.alert('System Error', 'Could not complete request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* 1. Background Image Layer */}
      <ImageBackground source={BG_IMAGE} style={styles.backgroundImage} resizeMode="cover">
        
        {/* 2. Gradient Overlay */}
        <LinearGradient
          colors={['rgba(15, 23, 42, 0.85)', 'rgba(30, 27, 75, 0.95)']} 
          style={StyleSheet.absoluteFill}
        />

        <KeyboardAwareScrollView
          contentContainerStyle={styles.scrollContent}
          enableOnAndroid
          extraScrollHeight={20}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View 
            style={[
              styles.contentWrapper, 
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
            ]}
          >
            {/* Header Section with Logo */}
            <View style={styles.header}>
              <View style={styles.logoContainer}>
                <Image 
                  source={LOGO_IMAGE} 
                  style={styles.logoImage} 
                  resizeMode="contain" 
                />
              </View>
              <Text style={styles.title}>SK Solutions <Text style={{fontWeight: '300'}}>Global</Text></Text>
              <Text style={styles.subtitle}>Register Terminal Access</Text>
            </View>

            {/* 3. Glassmorphism Card */}
            <View style={styles.glassCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Initialization</Text>
                <View style={styles.activeDot} />
              </View>

              {/* Employee ID */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>OPERATOR ID</Text>
                <View style={styles.inputContainer}>
                  <Feather name="hash" size={18} color="#94a3b8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter ID to auto-fetch details"
                    placeholderTextColor="#64748b"
                    value={id}
                    onChangeText={setId}
                    keyboardType="number-pad"
                    autoCapitalize="none"
                  />
                  {fetchingName && <ActivityIndicator size="small" color="#60a5fa" />}
                </View>
              </View>

              {/* Auto-filled Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>FULL NAME</Text>
                <View style={[styles.inputContainer, styles.readOnlyInput]}>
                  <Feather name="user" size={18} color={fullName ? "#fff" : "#64748b"} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, !fullName && styles.textDisabled]}
                    placeholder="Waiting for ID..."
                    placeholderTextColor="#475569"
                    value={fullName}
                    editable={false}
                  />
                  {fullName ? <Feather name="check-circle" size={16} color="#4ade80" /> : null}
                </View>
              </View>

              {/* Auto-filled Email */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>SYSTEM EMAIL</Text>
                <View style={[styles.inputContainer, styles.readOnlyInput]}>
                  <Feather name="mail" size={18} color={email ? "#fff" : "#64748b"} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, !email && styles.textDisabled]}
                    placeholder="Waiting for ID..."
                    placeholderTextColor="#475569"
                    value={email}
                    editable={false}
                  />
                </View>
              </View>

              {/* Password */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>SET PASSWORD</Text>
                <View style={styles.inputContainer}>
                  <Feather name="lock" size={18} color="#94a3b8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Create secure access key"
                    placeholderTextColor="#64748b"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                  />
                </View>
              </View>

              {/* Confirm Password */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>CONFIRM KEY</Text>
                <View style={styles.inputContainer}>
                  <Feather name="shield" size={18} color="#94a3b8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Re-enter access key"
                    placeholderTextColor="#64748b"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                  />
                </View>
              </View>

              {/* Sign Up Button */}
              <TouchableOpacity 
                style={styles.buttonShadow}
                onPress={handleSignup}
                disabled={loading}
                activeOpacity={0.8}
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
                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                      <Text style={styles.buttonText}>ESTABLISH LINK</Text>
                      <Feather name="link-2" size={18} color="#fff" style={{marginLeft: 8}}/>
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Footer Link */}
              <View style={styles.footer}>
                <TouchableOpacity onPress={() => router.push('/auth/login')}>
                  <Text style={styles.footerLink}>Back to Login Terminal</Text>
                </TouchableOpacity>
              </View>

            </View>
          </Animated.View>
        </KeyboardAwareScrollView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingTop: 60,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    width: 130, 
    height: 130,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
    shadowColor: '#60a5fa',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 25,
    elevation: 15,
  },
  logoImage: { 
    width: '100%', 
    height: '100%' 
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 2,
    marginBottom: 4,
    marginTop: -10,
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    letterSpacing: 1,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  glassCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 24,
    padding: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fbbf24', 
    shadowColor: '#fbbf24',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 8,
    letterSpacing: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(2, 6, 23, 0.5)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    height: 50,
    paddingHorizontal: 16,
  },
  readOnlyInput: {
    backgroundColor: 'rgba(15, 23, 42, 0.3)',
    borderColor: 'rgba(255,255,255,0.04)',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#fff',
    height: '100%',
    fontWeight: '500',
  },
  textDisabled: {
    color: '#475569',
  },
  buttonShadow: {
    marginTop: 16,
    marginBottom: 24,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 8,
  },
  button: {
    height: 54,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },
  footer: {
    alignItems: 'center',
  },
  footerLink: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
