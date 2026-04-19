import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

// ✅ Define the Item type
export interface Item {
  part_id: string;
  description: string;
}

export const useItems = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 🔎 Fetch single item by part_id
  const fetchItemByPartId = async (partId: string): Promise<Item | null> => {
    if (!partId) return null;
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('items')
        .select('part_id, description, model')
        .eq('part_id', partId)
        .maybeSingle<Item>();

      if (fetchError) {
        console.error('Error fetching item:', fetchError);
        setError(fetchError.message);
        return null;
      }

      return data;
    } catch (err) {
      console.error('Error fetching item:', err);
      setError('Failed to fetch item');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // 🔎 Fetch all items
  const fetchAllItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('items')
        .select('part_id, description, model')
        .order('part_id', { ascending: true });

      if (fetchError) {
        console.error('Error fetching items:', fetchError);
        setError(fetchError.message);
        return;
      }

      setItems(data || []);
    } catch (err) {
      console.error('Error fetching items:', err);
      setError('Failed to fetch items');
    } finally {
      setLoading(false);
    }
  }, []);

  // ✅ Auto-fetch on mount
  useEffect(() => {
    fetchAllItems();
  }, [fetchAllItems]);

  return {
    items,
    loading,
    error,
    fetchItemByPartId,
    refetch: fetchAllItems,
  };
};

