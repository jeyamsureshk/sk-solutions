import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import CycleTimeRecordsList from '@/components/CycleTimeRecordsList';
import { useCycleTime } from '@/hooks/useCycleTime';
import { CycleTimeRecord } from '@/types/database';

export default function CycleTimeRecordsScreen() {
  const [searchQuery, setSearchQuery] = useState('');

  const { getCycleTimeRecords } = useCycleTime();
  const [records, setRecords] = useState<CycleTimeRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRecords = async () => {
    setLoading(true);
    const result = await getCycleTimeRecords();
    if (result.success) {
      setRecords(result.data || []);
    }
    setLoading(false);
  };

  // Filter records based on search query (model name)
  const filteredRecords = records.filter((record) => {
    const query = searchQuery.toLowerCase();
    return record.model_name.toLowerCase().includes(query);
  });

  const clearFilters = () => {
    setSearchQuery('');
  };

  // Initial fetch
  useEffect(() => {
    fetchRecords();
  }, []);

  return (
    <View style={styles.container}>
      {/* App Header */}
      <View style={styles.appHeader}>
        <Text style={styles.appHeaderTitle}>⏱️ Cycle Time Dashboard</Text>
        <TouchableOpacity onPress={fetchRecords} style={styles.refreshButton}>
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* Section Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cycle Time Records</Text>
        <Text style={styles.headerSubtitle}>
          {filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Search Bar */}
      <View style={styles.filterBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by Model Name"
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

      <CycleTimeRecordsList
        records={filteredRecords}
        loading={loading}
        onRefresh={fetchRecords}
      />
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

  // Filter Bar
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

  // App Header
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
