import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { View, ActivityIndicator, StyleSheet, AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const segments = useSegments();
  const router = useRouter();
  
  // NEW: Ref to track the current state of the app (background/foreground)
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    // 1. Check for active session. Supabase handles reading the cached token automatically.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
    });

    // 2. Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // NEW: Global Presence Tracker
  // This will automatically update the user's last_seen whenever they are logged in 
  // and the app is active, without needing to track individual database queries.
  useEffect(() => {
    // Only track presence if the user is actually signed in
    if (!isAuthenticated) return;

    const updateLastSeen = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('profiles')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', user.id);
    };

    // Update immediately upon successful login/load
    updateLastSeen();

    // Listen for the app coming back from the background
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        updateLastSeen();
      }
      appState.current = nextAppState;
    });

    // Keep updating every 1 minute as long as the app stays open on the screen
    const interval = setInterval(() => {
      if (appState.current === 'active') {
        updateLastSeen();
      }
    }, 60000); 

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [isAuthenticated]);

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

  // Check if we are in the "auth" folder (login/signup)
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
