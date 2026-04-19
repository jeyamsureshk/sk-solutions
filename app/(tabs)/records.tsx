import { useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import ProductionRecordsList from '@/components/ProductionRecordsList';
import ProductionForm from '@/components/ProductionForm';
import { useProductionRecords } from '@/hooks/useProductionRecords';
import { ProductionRecord, ProductionRecordInsert } from '@/types/database';
import { Filters } from '@/types/summary';
import { useTeams } from '@/hooks/useTeams';
import { X } from 'lucide-react-native';

export default function RecordsScreen() {
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({});
  const [showFromDatePicker, setShowFromDatePicker] = useState(false);
  const [showToDatePicker, setShowToDatePicker] = useState(false);
  const hasActiveFilters = Object.keys(filters).length > 0;

  const { records, loading, fetchRecords, updateRecord, deleteRecord } = useProductionRecords(filters);
  const { teams } = useTeams();
  const [editingRecord, setEditingRecord] = useState<ProductionRecord | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const handleEdit = (record: ProductionRecord) => {
    setEditingRecord(record);
    setIsModalVisible(true);
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete Record',
      'Are you sure you want to delete this production record?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteRecord(id);
            if (result.success) {
              Alert.alert('Success', 'Record deleted successfully');
            } else {
              Alert.alert('Error', 'Failed to delete record');
            }
          },
        },
      ]
    );
  };

  const handleUpdate = async (data: ProductionRecordInsert): Promise<{ success: boolean; error?: string }> => {
    if (!editingRecord) return { success: false, error: 'No record to update' };

    const result = await updateRecord(editingRecord.id, data);

    if (result.success) {
      Alert.alert('Success', 'Record updated successfully');
      setIsModalVisible(false);
      setEditingRecord(null);
      return { success: true };
    } else {
      const errorMessage = typeof result.error === 'string' ? result.error : 'Failed to update record';
      Alert.alert('Error', errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
    setEditingRecord(null);
  };

  const onFromDateChange = (event: any, date?: Date) => {
    setShowFromDatePicker(Platform.OS === 'ios');
    if (date) {
      setFilters(prev => ({ ...prev, fromDate: date.toISOString().split('T')[0] }));
    }
  };

  const onToDateChange = (event: any, date?: Date) => {
    setShowToDatePicker(Platform.OS === 'ios');
    if (date) {
      setFilters(prev => ({ ...prev, toDate: date.toISOString().split('T')[0] }));
    }
  };

  const clearFilters = () => {
    setFilters({});
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Production Records</Text>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Text style={styles.filterButtonText}>Filters</Text>
            {hasActiveFilters && <View style={styles.filterIndicator} />}
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSubtitle}>
          {records.length} record{records.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Filters */}
      {showFilters && (
        <View style={styles.filtersContainer}>
          {/* Date filters */}
          <View style={styles.filterRow}>
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>From Date</Text>
              <TouchableOpacity style={styles.input} onPress={() => setShowFromDatePicker(true)}>
                <Text style={{ color: '#1f2937' }}>{filters.fromDate || 'Select date'}</Text>
              </TouchableOpacity>
              {showFromDatePicker && (
                <DateTimePicker
                  value={filters.fromDate ? new Date(filters.fromDate) : new Date()}
                  mode="date"
                  display="default"
                  onChange={onFromDateChange}
                />
              )}
            </View>
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>To Date</Text>
              <TouchableOpacity style={styles.input} onPress={() => setShowToDatePicker(true)}>
                <Text style={{ color: '#1f2937' }}>{filters.toDate || 'Select date'}</Text>
              </TouchableOpacity>
              {showToDatePicker && (
                <DateTimePicker
                  value={filters.toDate ? new Date(filters.toDate) : new Date()}
                  mode="date"
                  display="default"
                  onChange={onToDateChange}
                />
              )}
            </View>
          </View>

          {/* Team + Model */}
          <View style={styles.filterRow}>
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Team</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={filters.team || ''}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, team: value || undefined }))}
                  style={styles.picker}
                >
                  <Picker.Item label="All teams" value="" />
                  {teams.map((team: string) => (
                    <Picker.Item key={team} label={team} value={team} />
                  ))}
                </Picker>
              </View>
            </View>
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Model</Text>
              <TextInput
                style={styles.input}
                value={filters.model || ''}
                onChangeText={(value) => setFilters(prev => ({ ...prev, model: value || undefined }))}
                placeholder="Model name"
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>

          {/* Hour filters */}
          <View style={styles.filterRow}>
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Hour Min (0-23.5)</Text>
              <TextInput
                style={styles.input}
                value={filters.hourMin?.toString() || ''}
                onChangeText={(value) => setFilters(prev => ({ ...prev, hourMin: value ? parseFloat(value) : undefined }))}
                placeholder="Min hour"
                keyboardType="numeric"
                placeholderTextColor="#9ca3af"
              />
            </View>
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Hour Max (0-23.5)</Text>
              <TextInput
                style={styles.input}
                value={filters.hourMax?.toString() || ''}
                onChangeText={(value) => setFilters(prev => ({ ...prev, hourMax: value ? parseFloat(value) : undefined }))}
                placeholder="Max hour"
                keyboardType="numeric"
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>

          {/* Efficiency filters */}
          <View style={styles.filterRow}>
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Efficiency Min (%)</Text>
              <TextInput
                style={styles.input}
                value={filters.efficiencyMin?.toString() || ''}
                onChangeText={(value) => setFilters(prev => ({ ...prev, efficiencyMin: value ? parseFloat(value) : undefined }))}
                placeholder="Min efficiency"
                keyboardType="numeric"
                placeholderTextColor="#9ca3af"
              />
            </View>
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Efficiency Max (%)</Text>
              <TextInput
                style={styles.input}
                value={filters.efficiencyMax?.toString() || ''}
                onChangeText={(value) => setFilters(prev => ({ ...prev, efficiencyMax: value ? parseFloat(value) : undefined }))}
                placeholder="Max efficiency"
                keyboardType="numeric"
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>

          <TouchableOpacity style={styles.clearButton} onPress={clearFilters}>
            <Text style={styles.clearButtonText}>Clear Filters</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Records list */}
          <ProductionRecordsList
        records={records}
        loading={loading}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onRefresh={fetchRecords}
      />

      {/* Edit Record Modal with KeyboardAvoidingView */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseModal}
        transparent={false}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Record</Text>
              <TouchableOpacity onPress={handleCloseModal} style={styles.closeButton}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalContent}
              contentContainerStyle={{ paddingBottom: 48 }}
              keyboardShouldPersistTaps="handled"
            >
              {editingRecord && (
                <ProductionForm
                  onSubmit={async (data) => {
                    Keyboard.dismiss();
                    return handleUpdate(data);
                  }}
                  onCancel={handleCloseModal}
                  initialData={editingRecord}
                  submitButtonText="Update Record"
                />
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  filterButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  filtersContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  filterGroup: {
    flex: 1,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
    color: '#1f2937',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  picker: {
    height: 50,
    color: '#1f2937',
  } as any,
  clearButton: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  clearButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  filterIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#7c7',
    marginLeft: 6,
  },
});

