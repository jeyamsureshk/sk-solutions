import { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Text,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import YieldForm from '@/components/YieldForm';
import { useYield } from '@/hooks/useYield';
import { YieldInsert } from '@/types/database';
import { X } from 'lucide-react-native';

export default function AddYieldRecordScreen() {
  const router = useRouter();
  const { addYieldRecord } = useYield();
  const [formKey, setFormKey] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const tipOpacity = useRef(new Animated.Value(0)).current;
  const tipTranslateY = useRef(new Animated.Value(-20)).current;

  const handleSubmit = async (data: YieldInsert) => {
    const result = await addYieldRecord(data);

    if (result.success) {
      Alert.alert('Success', 'Yield record added successfully', [
        {
          text: 'OK',
          onPress: () => {
            setFormKey(prev => prev + 1);
            router.push('/yield'); // ✅ navigate back to yield list
          },
        },
      ]);
      return { success: true };
    } else {
      alert(result.error || 'Failed to add yield record. Please try again.');
      return { success: false, error: result.error };
    }
  };

  const handleClear = () => {
    setFormKey(prev => prev + 1);
  };

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
        Animated.parallel([
          Animated.timing(tipOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(tipTranslateY, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      }
    );

    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        Animated.parallel([
          Animated.timing(tipOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(tipTranslateY, {
            toValue: -20,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => setKeyboardVisible(false));
      }
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ✅ Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Add Yield Record</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <X size={24} color="#6b7280" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.keyboardBoxTop,
            {
              opacity: tipOpacity,
              transform: [{ translateY: tipTranslateY }],
            },
          ]}
        >
          <Text style={styles.keyboardBoxText}>
            Tip: Double-check Date and Model Name
          </Text>
        </Animated.View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <YieldForm
            key={formKey}
            onSubmit={handleSubmit}
            submitButtonText="Add Yield Record"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  keyboardBoxTop: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 12 : 8,
    left: 16,
    right: 16,
    marginBottom: 4,
    backgroundColor: '#2563eb',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    zIndex: 999,
    elevation: 5,
  },
  keyboardBoxText: {
    color: '#ffffff',
    fontSize: 13,
    textAlign: 'center',
  },
});

