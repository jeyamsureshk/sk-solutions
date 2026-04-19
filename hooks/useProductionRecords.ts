import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { ProductionRecord, ProductionRecordInsert, ProductionRecordUpdate } from '@/types/database';
import { Filters } from '@/types/summary';

export function useProductionRecords(filters?: Filters) {
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      
      let allData: any[] = [];
      let keepFetching = true;
      let offset = 0;
      const PAGE_SIZE = 1000;

      // Loop to bypass the 1000 row limit
      while (keepFetching) {
        let query = supabase
          .from('production_records')
          .select('*')
          .order('date', { ascending: false })
          .order('hour', { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1);

        // Apply Server-Side Filters (Date, Team, Hour)
        if (filters?.fromDate) query = query.gte('date', filters.fromDate);
        if (filters?.toDate) query = query.lte('date', filters.toDate);
        if (filters?.team) query = query.eq('team', filters.team);
        if (filters?.hourMin !== undefined) query = query.gte('hour', filters.hourMin);
        if (filters?.hourMax !== undefined) query = query.lte('hour', filters.hourMax);

        const { data, error } = await query;

        if (error) throw error;

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          offset += PAGE_SIZE;
        }

        // If we received fewer than 1000 rows, we've reached the end
        if (!data || data.length < PAGE_SIZE) {
          keepFetching = false;
        }
      }

      let filteredData = allData;

      // Apply Complex Client-Side Filters (Efficiency & Model)
      // Efficiency Filter
      if (filters?.efficiencyMin !== undefined || filters?.efficiencyMax !== undefined) {
        filteredData = filteredData.filter((record: ProductionRecord) => {
          const efficiency = record.target_units > 0 ? (record.units_produced / record.target_units) * 100 : 0;
          const minCheck = filters.efficiencyMin === undefined || efficiency >= filters.efficiencyMin;
          const maxCheck = filters.efficiencyMax === undefined || efficiency <= filters.efficiencyMax;
          return minCheck && maxCheck;
        });
      }

      // Model Filter (case and space insensitive)
      if (filters?.model) {
        const searchTerm = filters.model.toLowerCase().replace(/\s+/g, '');
        filteredData = filteredData.filter((record: ProductionRecord) => {
          if (!record.item || !Array.isArray(record.item)) return false;
          return record.item.some((item: any) => {
            const modelName = (item.model || '').toLowerCase().replace(/\s+/g, '');
            return modelName.includes(searchTerm);
          });
        });
      }

      setRecords(filteredData);
    } catch (error) {
      console.error('Error fetching records:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const addRecord = async (record: ProductionRecordInsert) => {
    try {
      const { data: existingRecords, error: checkError } = await supabase
        .from('production_records')
        .select('id')
        .eq('team', record.team)
        .eq('date', record.date)
        .eq('hour', record.hour);

      if (checkError) throw checkError;
      if (existingRecords && existingRecords.length > 0) {
        return { success: false, error: 'A record for this team already exists for the selected date and hour.' };
      }

      const { error } = await supabase.from('production_records').insert(record as any);
      if (error) throw error;
      await fetchRecords();
      return { success: true };
    } catch (error) {
      console.error('Error adding record:', error);
      return { success: false, error };
    }
  };

  const updateRecord = async (id: string, updates: ProductionRecordUpdate) => {
    try {
      const { error } = await supabase
        .from('production_records')
        .update(updates as any as never)
        .eq('id', id);

      if (error) throw error;
      await fetchRecords();
      return { success: true };
    } catch (error) {
      console.error('Error updating record:', error);
      return { success: false, error };
    }
  };

  const deleteRecord = async (id: string) => {
    try {
      const { error } = await supabase.from('production_records').delete().eq('id', id);
      if (error) throw error;
      await fetchRecords();
      return { success: true };
    } catch (error) {
      console.error('Error deleting record:', error);
      return { success: false, error };
    }
  };

  useEffect(() => {
    fetchRecords();

    const channel = supabase
      .channel('production_records_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_records' }, () => {
        fetchRecords();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRecords]);

  return {
    records,
    loading,
    fetchRecords,
    addRecord,
    updateRecord,
    deleteRecord,
  };
}
