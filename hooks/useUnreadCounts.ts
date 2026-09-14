import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

const getCacheKey = (userId: string) => `messages:unread:${userId}`;

export function useUnreadCounts(userId?: string) {
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const fetchUnreadCounts = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('messages')
        .select('sender_id')
        .eq('receiver_id', userId)
        .eq('read', false);

      if (error) throw error;

      const counts: Record<string, number> = {};
      data?.forEach((msg) => {
        counts[msg.sender_id] = (counts[msg.sender_id] || 0) + 1;
      });

      setUnreadCounts(counts);
      await AsyncStorage.setItem(getCacheKey(userId), JSON.stringify(counts));
    } catch (err) {
      console.error('Failed to fetch unread counts:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    AsyncStorage.getItem(getCacheKey(userId)).then((cached) => {
      if (!cached) return;
      try {
        setUnreadCounts(JSON.parse(cached) as Record<string, number>);
      } catch {
        AsyncStorage.removeItem(getCacheKey(userId));
      }
    });

    fetchUnreadCounts();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`unread-counts-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        () => fetchUnreadCounts()
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        () => fetchUnreadCounts()
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
        },
        () => fetchUnreadCounts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return {
    unreadCounts,
    loading,
    refetch: fetchUnreadCounts,
  };
}
