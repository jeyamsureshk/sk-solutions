import React, { useState } from 'react';
import {
  View,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  Platform,
  Dimensions,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import YieldRecordItem from '@/components/YieldRecordItem';
import { Yield } from '@/types/database';
import { Trash2, Calendar } from 'lucide-react-native';

const { width } = Dimensions.get('window');
type Tab = 'day' | 'month' | 'year';

interface YieldRecordsListProps {
  records?: Yield[];
  loading: boolean;
  onEdit: (record: Yield) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}

export default function YieldRecordsList({
  records = [],
  loading,
  onEdit,
  onDelete,
  onRefresh,
}: YieldRecordsListProps) {
  const [activeTab, setActiveTab] = useState<Tab>('day');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const sortedRecords = [...records].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const filterRecords = (records: Yield[], type: Tab, selectedDate: Date | null) => {
    if (!selectedDate) return records;
    return records.filter((r) => {
      const d = new Date(r.date);
      if (type === 'day') {
        return d.toLocaleDateString('en-GB') === selectedDate.toLocaleDateString('en-GB');
      } else if (type === 'month') {
        return (
          d.getMonth() === selectedDate.getMonth() &&
          d.getFullYear() === selectedDate.getFullYear()
        );
      } else {
        return d.getFullYear() === selectedDate.getFullYear();
      }
    });
  };

  const filteredRecords = filterRecords(sortedRecords, activeTab, selectedDate);

  const groupBy = (records: Yield[], type: Tab) => {
    const groups: Record<string, number> = {};
    records.forEach((r) => {
      const d = new Date(r.date);
      let key = '';
      if (type === 'day') {
        key = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      } else if (type === 'month') {
        key = `${d.toLocaleString('en-GB', { month: 'short' })} ${d.getFullYear()}`;
      } else {
        key = `${d.getFullYear()}`;
      }
      groups[key] = (groups[key] || 0) + r.quantity;
    });
    return Object.entries(groups).map(([key, total]) => ({ key, total }));
  };

  const groupedTotals = groupBy(filteredRecords, activeTab);

  if (loading && records.length === 0) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      {/* Date Picker Row */}
      <View style={styles.dateRow}>
        <TouchableOpacity
          style={styles.datePickerButton}
          onPress={() => setShowPicker(true)}
        >
          <Calendar size={16} color="#64748b" style={{ marginRight: 6 }} />
          <Text style={styles.datePickerText}>
            {selectedDate
              ? selectedDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
              : 'Select Date'}
          </Text>
        </TouchableOpacity>

        {selectedDate && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setSelectedDate(null)}
          >
            <Trash2 size={16} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {showPicker && (
        <DateTimePicker
          value={selectedDate || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => {
            setShowPicker(false);
            if (date) setSelectedDate(date);
          }}
        />
      )}

      {/* Tabs Section */}
      <View style={styles.tabs}>
        {(['day', 'month', 'year'] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={activeTab === tab ? styles.activeTabText : styles.tabText}>
              {tab.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ✅ Conditional Totals: Only show when NO date is selected */}
      {!selectedDate && (
        <View style={styles.horizontalScrollWrapper}>
          <FlatList
            data={groupedTotals}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.key}
            renderItem={({ item }) => (
              <View style={styles.totalCardHorizontal}>
                <Text style={styles.totalKey}>{item.key}</Text>
                <Text style={styles.totalValue}>{item.total}</Text>
              </View>
            )}
            contentContainerStyle={styles.horizontalListContent}
          />
        </View>
      )}

      {/* List Header: Shows 'Details' or the 'Filter Summary' */}
      <View style={styles.listHeader}>
        <Text style={styles.listHeaderText}>
          {selectedDate ? `Details for ${activeTab}` : 'All Details'}
        </Text>
        {selectedDate && groupedTotals.length > 0 && (
            <Text style={styles.summaryBadge}>
                Total: {groupedTotals[0].total}
            </Text>
        )}
      </View>

      <FlatList
        data={filteredRecords}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <YieldRecordItem record={item} onEdit={onEdit} onDelete={onDelete} />
        )}
        contentContainerStyle={styles.mainListPadding}
        refreshing={loading}
        onRefresh={onRefresh}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No records found for this period. h</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  mainListPadding: { paddingHorizontal: 16, paddingBottom: 20 },
  
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
  },
  datePickerButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  datePickerText: { fontSize: 13, color: '#1e293b', fontWeight: '500' },
  clearButton: {
    marginLeft: 6,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#ef4444',
  },

  tabs: { 
    flexDirection: 'row', 
    marginVertical: 8,
    backgroundColor: '#f1f5f9',
    marginHorizontal: 16,
    borderRadius: 10,
    padding: 3
  },
  tab: { flex: 1, paddingVertical: 6, borderRadius: 8, alignItems: 'center' },
  activeTab: { backgroundColor: '#fff', elevation: 1 },
  tabText: { color: '#64748b', fontWeight: '600', fontSize: 11 },
  activeTabText: { color: '#2563eb', fontWeight: '700', fontSize: 11 },

  horizontalScrollWrapper: {
    height: 70, 
    marginVertical: 4,
  },
  horizontalListContent: {
    paddingHorizontal: 16,
    gap: 8, 
    alignItems: 'center'
  },
  totalCardHorizontal: {
    backgroundColor: '#fff',
    minWidth: 100, 
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
  },
  totalKey: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
  },

  listHeader: { 
    paddingHorizontal: 16, 
    marginTop: 8, 
    marginBottom: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  listHeaderText: { 
    fontSize: 11, 
    fontWeight: '800', 
    color: '#94a3b8', 
    textTransform: 'uppercase' 
  },
  summaryBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  emptyContainer: {
    marginTop: 40,
    alignItems: 'center'
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 13
  }
});
