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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import ProductionForm from '@/components/ProductionFormDay';
import { useProductionRecords } from '@/hooks/useProductionRecords';
import { ProductionRecordInsert } from '@/types/database';

export default function AddRecordScreen() {
  const router = useRouter();
  const { addRecord } = useProductionRecords();
  const [formKey, setFormKey] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const tipOpacity = useRef(new Animated.Value(0)).current;
  const tipTranslateY = useRef(new Animated.Value(-20)).current;

  const handleSubmit = async (data: ProductionRecordInsert) => {
    const result = await addRecord(data);

    if (result.success) {
      Alert.alert('Success', 'Record added successfully', [
        {
          text: 'OK',
          onPress: () => {
            setFormKey(prev => prev + 1);
            router.push('/(tabs)/records');
          },
        },
      ]);
      return { success: true };
    } else {
      alert(result.error || 'Failed to add record. Please try again.');
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
    <SafeAreaView style={{ flex: 1 }}>
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
            Tip: Double-check Date, Hour and Team
          </Text>
        </Animated.View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <ProductionForm
            key={formKey}
            onSubmit={handleSubmit}
            submitButtonText="Add Record"
            onClear={handleClear}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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

