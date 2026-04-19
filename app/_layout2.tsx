import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          setIsAuthenticated(true);
        } else {
          const cachedEmail = await AsyncStorage.getItem('userEmail');
          const cachedPassword = await AsyncStorage.getItem('userPassword');
          
          if (cachedEmail && cachedPassword) {
            const { error } = await supabase.auth.signInWithPassword({
              email: cachedEmail,
              password: cachedPassword,
            });
            setIsAuthenticated(!error);
          } else {
            setIsAuthenticated(false);
          }
        }
      } catch (e) {
        setIsAuthenticated(false);
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (isAuthenticated === null) return;

    const inAuthGroup = segments[0] === 'auth';

    if (isAuthenticated && inAuthGroup) {
      // User is signed in, redirect to tabs
      router.replace('/(tabs)');
    } else if (!isAuthenticated && !inAuthGroup) {
      // User is NOT signed in, redirect to login
      router.replace('/auth/login');
    }
  }, [isAuthenticated, segments]);

  // --- THE FIX ---
  // Check if we are in the "Auth" folder (login/signup)
  const inAuthGroup = segments[0] === 'auth';

  // 1. If Auth state is unknown (null) -> Show Splash
  // 2. If Not Authenticated AND we are NOT yet in the auth folder -> Show Splash
  //    (This prevents the (tabs) from rendering while the router is redirecting)
  if (isAuthenticated === null || (!isAuthenticated && !inAuthGroup)) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/signup" />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a', // Match your app theme background
  },
});
