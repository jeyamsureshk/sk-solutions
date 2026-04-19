import { useState, useCallback } from 'react';
import {
  FlatList,
  Text,
  View,
  StyleSheet,
  RefreshControl,
  ListRenderItem,
  Alert,
} from 'react-native';
import { CycleTimeRecord } from '@/types/database';
import CycleTimeRecordItem from './CycleTimeRecordItem';
import { supabase } from '@/lib/supabase'; // adjust import to your setup
import { useNavigation } from '@react-navigation/native';

interface CycleTimeRecordsListProps {
  records: CycleTimeRecord[];
  loading: boolean;
  onRefresh: () => void;
}

const PAGE_SIZE = 15;

export default function CycleTimeRecordsList({
  records,
  loading,
  onRefresh,
}: CycleTimeRecordsListProps) {
  const [page, setPage] = useState(1);
  const navigation = useNavigation();

  const paginatedRecords = records.slice(0, page * PAGE_SIZE);
  const hasMore = paginatedRecords.length < records.length;

  const loadNextPage = () => {
    if (hasMore && !loading) {
      setPage(prev => prev + 1);
    }
  };

  const handleRefresh = () => {
    setPage(1);
    onRefresh();
  };

  // Edit handler → navigate to form screen with record
  const handleUpdate = (record: CycleTimeRecord) => {
    navigation.navigate('cycle-time', { record: JSON.stringify(record) });
  };

  // Delete handler → confirm + Supabase delete
  const handleDelete = async (id: string) => {
    Alert.alert('Confirm Delete', 'Are you sure you want to delete this record?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('cycle_time_records').delete().eq('id', id);
          if (error) {
            Alert.alert('Error', error.message);
          } else {
            onRefresh(); // reload after delete
          }
        },
      },
    ]);
  };

  const renderItem: ListRenderItem<CycleTimeRecord> = useCallback(
    ({ item }) => (
      <CycleTimeRecordItem
        record={item}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    ),
    []
  );

  if (!loading && records.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No cycle time records yet</Text>
        <Text style={styles.emptySubtext}>
          Add your first cycle time record to get started  h h
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={paginatedRecords}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      contentContainerStyle={styles.listContainer}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={handleRefresh} />
      }
      onEndReached={loadNextPage}
      onEndReachedThreshold={0.5}
      initialNumToRender={20}
      maxToRenderPerBatch={20}
      windowSize={10}
      removeClippedSubviews={true}
    />
  );
}

const styles = StyleSheet.create({
  listContainer: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
  },
});

