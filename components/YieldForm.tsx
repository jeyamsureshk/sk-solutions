import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { YieldInsert } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { Calendar, Package, Users, Info, PlusCircle, XCircle, ChevronRight } from 'lucide-react-native';

interface YieldFormProps {
  onSubmit: (data: YieldInsert) => Promise<{ success: boolean; error?: any }>;
  onCancel?: () => void;
  initialData?: any;
  submitButtonText?: string;
}

const THEME = {
  primary: '#2563EB',
  bg: '#F8FAFC',
  textMain: '#1E293B',
  textMuted: '#64748B',
  border: '#E2E8F0',
  white: '#FFFFFF',
  danger: '#EF4444',
};

export default function YieldForm({
  onSubmit,
  onCancel,
  initialData,
  submitButtonText = 'Add Yield Record',
}: YieldFormProps) {
  const [date, setDate] = useState<Date>(
    initialData?.date ? new Date(initialData.date) : new Date()
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [modelName, setModelName] = useState(initialData?.model_name || '');
  const [quantity, setQuantity] = useState(initialData?.quantity?.toString() || '');
  const [problem, setProblem] = useState(initialData?.problem || '');
  const [supplierName, setSupplierName] = useState(initialData?.supplier_name || '');
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('email').eq('id', user.id).single();
        if (profile?.email) {
          const { data: operator } = await supabase.from('operators').select('id').eq('email', profile.email).single();
          if (operator?.id) setCurrentUserId(operator.id);
        }
      }
    };
    getCurrentUser();
  }, []);

  const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    // Android requires manual closing, iOS handles it via the modal interaction
    if (Platform.OS === 'android') setShowDatePicker(false);
    
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const handleSubmit = async () => {
    const quantityNum = parseInt(quantity);
    if (!modelName.trim() || !supplierName.trim() || isNaN(quantityNum) || quantityNum <= 0) {
      Alert.alert('Incomplete Form', 'Please fill in all required fields correctly.');
      return;
    }

    const formData: YieldInsert = {
      date: date.toISOString().split('T')[0],
      model_name: modelName.trim(),
      supplier_name: supplierName.trim(),
      quantity: quantityNum,
      problem: problem.trim() || null,
      operator_id: currentUserId || 0,
    };

    const result = await onSubmit(formData);
    if (!result.success) Alert.alert('Error', result.error || 'Failed to save record');
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={{ flex: 1 }}
    >
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Yield Entry</Text>
        <Text style={styles.subtitle}>Log manufacturing yield and issues</Text>

        {/* Date Picker Input */}
        
        <View style={styles.fieldContainer}>
          <View style={styles.labelRow}>
            <Calendar size={16} color={THEME.textMuted} />
            <Text style={styles.label}>Production Date</Text>
          </View>
          <TouchableOpacity 
            activeOpacity={0.7} 
            style={styles.pickerTrigger} 
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.inputText}>
              {date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </Text>
            <ChevronRight size={18} color={THEME.textMuted} />
          </TouchableOpacity>
          
          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={onDateChange}
              maximumDate={new Date()} // Prevent picking future dates
            />
          )}
        </View>

        {/* Model Name Field */}
        <View style={styles.fieldContainer}>
          <View style={styles.labelRow}>
            <Package size={16} color={THEME.textMuted} />
            <Text style={styles.label}>Model Name</Text>
          </View>
          <TextInput
            style={styles.input}
            value={modelName}
            onChangeText={setModelName}
            placeholder="e.g. RE 717MC Encloser"
            placeholderTextColor="#A0AEC0"
          />
        </View>

        {/* Responsible Team Field */}
        <View style={styles.fieldContainer}>
          <View style={styles.labelRow}>
            <Users size={16} color={THEME.textMuted} />
            <Text style={styles.label}>Responsible Team / Supplier</Text>
          </View>
          <TextInput
            style={styles.input}
            value={supplierName}
            onChangeText={setSupplierName}
            placeholder="e.g. SMT Team / Vendor A"
            placeholderTextColor="#A0AEC0"
          />
        </View>

        {/* Quantity Field */}
        <View style={styles.fieldContainer}>
          <View style={styles.labelRow}>
            <Info size={16} color={THEME.textMuted} />
            <Text style={styles.label}>Quantity Affected</Text>
          </View>
          <TextInput
            style={styles.input}
            value={quantity}
            onChangeText={setQuantity}
            placeholder="0"
            keyboardType="number-pad"
            placeholderTextColor="#A0AEC0"
          />
        </View>

        {/* Problem Field */}
        <View style={styles.fieldContainer}>
          <View style={styles.labelRow}>
            <Info size={16} color={THEME.textMuted} />
            <Text style={styles.label}>Detailed Problem (Optional)</Text>
          </View>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={problem}
            onChangeText={setProblem}
            placeholder="Describe the defect or reason for yield loss..."
            multiline
            numberOfLines={4}
            placeholderTextColor="#A0AEC0"
          />
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
            <PlusCircle size={20} color={THEME.white} />
            <Text style={styles.submitBtnText}>{submitButtonText}</Text>
          </TouchableOpacity>

          {onCancel && (
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <XCircle size={20} color={THEME.textMuted} />
              <Text style={styles.cancelBtnText}>Discard</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  scrollContent: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '800', color: THEME.textMain, marginBottom: 4 },
  subtitle: { fontSize: 16, color: THEME.textMuted, marginBottom: 32 },
  fieldContainer: { marginBottom: 20 },
  labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  label: { fontSize: 13, fontWeight: '700', color: THEME.textMain, textTransform: 'uppercase', letterSpacing: 0.5 },
  pickerTrigger: {
    backgroundColor: THEME.white,
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  input: {
    backgroundColor: THEME.white,
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: THEME.textMain,
  },
  inputText: { fontSize: 16, color: THEME.textMain, fontWeight: '500' },
  textArea: { height: 100, textAlignVertical: 'top' },
  actions: { marginTop: 12, gap: 12 },
  submitBtn: {
    backgroundColor: THEME.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
    borderRadius: 14,
    gap: 10,
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: { color: THEME.white, fontSize: 16, fontWeight: '700' },
  cancelBtn: { backgroundColor: 'transparent', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 14, gap: 8 },
  cancelBtnText: { color: THEME.textMuted, fontSize: 16, fontWeight: '600' },
});
