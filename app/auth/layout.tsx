// app/(auth)/layout.tsx
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false, // Hide headers for a clean auth experience
      }}
    />
  );
}

