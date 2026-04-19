import { useState, useCallback, useMemo } from 'react';
import {
  FlatList,
  Text,
  View,
  StyleSheet,
  RefreshControl,
  ListRenderItem,
} from 'react-native';
import { ProductionRecord } from '@/types/database';
import ProductionDayCard from './ProductionDayCard';

interface ProductionRecordsListProps {
  records: ProductionRecord[];
  loading: boolean;
  onEdit: (record: ProductionRecord) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}

interface GroupedRecord {
  key: string;
  team: string;
  date: string;
  records: ProductionRecord[];
}

const PAGE_SIZE = 15;

export default function ProductionRecordsList({
  records,
  loading,
  onEdit,
  onDelete,
  onRefresh,
}: ProductionRecordsListProps) {
  const [page, setPage] = useState(1);

  const groupedRecords = useMemo(() => {
    const groups: Record<string, ProductionRecord[]> = {};
    records.forEach(record => {
      const key = `${record.team}|${record.date}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(record);
    });

    const grouped: GroupedRecord[] = Object.entries(groups).map(([key, recs]) => {
      const [team, date] = key.split('|');
      return {
        key,
        team,
        date,
        records: recs.sort((a, b) => a.hour - b.hour), // Sort by hour
      };
    });

    // Sort groups by date descending, then by team
    grouped.sort((a, b) => {
      if (a.date !== b.date) {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
      return a.team.localeCompare(b.team);
    });

    return grouped;
  }, [records]);

  const paginatedGroups = groupedRecords.slice(0, page * PAGE_SIZE);
  const hasMore = paginatedGroups.length < groupedRecords.length;

  const loadNextPage = () => {
    if (hasMore && !loading) {
      setPage(prev => prev + 1);
    }
  };

  const handleRefresh = () => {
    setPage(1);
    onRefresh();
  };

  const renderItem: ListRenderItem<GroupedRecord> = useCallback(
    ({ item }) => (
      <ProductionDayCard
        team={item.team}
        date={item.date}
        records={item.records}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    ),
    [onEdit, onDelete]
  );

  if (!loading && records.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No production records yet</Text>
        <Text style={styles.emptySubtext}>Add your first record to get started    </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={paginatedGroups}
      keyExtractor={(item) => item.key}
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

