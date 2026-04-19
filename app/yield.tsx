import { useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Text,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import YieldRecordsList from '@/components/YieldRecordsList';
import YieldForm from '@/components/YieldForm';
import { useYield } from '@/hooks/useYield';
import { Yield, YieldInsert } from '@/types/database';
import { X } from 'lucide-react-native';

export default function YieldScreen() {
  const [editingRecord, setEditingRecord] = useState<Yield | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  // ✅ filter state (search only)
  const [searchQuery, setSearchQuery] = useState('');

  const { yieldRecords, loading, refetch, updateYieldRecord, deleteYieldRecord } = useYield();

  const handleEdit = (record: Yield) => {
    setEditingRecord(record);
    setIsModalVisible(true);
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete Record',
      'Are you sure you want to delete this yield record?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteYieldRecord(id);
            if (result.success) {
              Alert.alert('Success', 'Record deleted successfully');
              refetch();
            } else {
              Alert.alert('Error', result.error || 'Failed to delete record');
            }
          },
        },
      ]
    );
  };

  const handleUpdate = async (data: YieldInsert): Promise<{ success: boolean; error?: string }> => {
    if (!editingRecord) return { success: false, error: 'No record to update' };

    const result = await updateYieldRecord(editingRecord.id, data);

    if (result.success) {
      Alert.alert('Success', 'Record updated successfully');
      setIsModalVisible(false);
      setEditingRecord(null);
      refetch();
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

 // ✅ filter logic (search across model + supplier + description/problem)
const filteredRecords = yieldRecords.filter((rec) => {
  const query = searchQuery.toLowerCase();
  const matchesModel = rec.model_name.toLowerCase().includes(query);
  const matchesSupplier = rec.supplier_name?.toLowerCase().includes(query); // ✅ new
  const matchesDescription = rec.problem?.toLowerCase().includes(query);
  return matchesModel || matchesSupplier || matchesDescription;
});

  // ✅ clear filters
  const clearFilters = () => {
    setSearchQuery('');
  };

  return (
    <View style={styles.container}>
      {/* ✅ App Header */}
      <View style={styles.appHeader}>
        <Text style={styles.appHeaderTitle}>📊 Yield Dashboard</Text>
        <TouchableOpacity onPress={refetch} style={styles.refreshButton}>
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* ✅ Section Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Yield Records</Text>
        <Text style={styles.headerSubtitle}>
          {filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* ✅ Search Bar */}
      <View style={styles.filterBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by Model or Description"
          placeholderTextColor="#9ca3af"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        {searchQuery.length > 0 && (
          <TouchableOpacity style={styles.clearButton} onPress={clearFilters}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      <YieldRecordsList
        records={filteredRecords}
        loading={loading}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onRefresh={refetch}
      />

      {/* ✅ Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Record</Text>
            <TouchableOpacity onPress={handleCloseModal} style={styles.closeButton}>
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>
          <View style={styles.modalContent}>
            {editingRecord && (
              <YieldForm
                onSubmit={handleUpdate}
                onCancel={handleCloseModal}
                initialData={editingRecord}
                submitButtonText="Update Record"
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1f2937', marginBottom: 4 },
  headerSubtitle: { fontSize: 14, color: '#6b7280' },

  // ✅ Filter Bar
  filterBar: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    color: '#1f2937',
    fontSize: 14,
  },
  clearButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#ef4444',
    borderRadius: 8,
  },
  clearButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },

  // ✅ Modal
  modalContainer: { flex: 1, backgroundColor: '#f3f4f6' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1f2937' },
  closeButton: { padding: 4 },
  modalContent: { flex: 1, padding: 16 },

  // ✅ App Header
  appHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    paddingTop: 50,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  appHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  refreshButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  refreshButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});

