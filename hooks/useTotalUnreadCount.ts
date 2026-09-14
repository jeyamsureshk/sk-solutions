import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export function useTotalUnreadCount(userId?: string) {
  const [totalUnread, setTotalUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  // 1. Wrap in useCallback and move above useEffect to fix dependency warnings
  const fetchTotalUnread = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', userId)
        .eq('read', false);

      if (error) throw error;
      setTotalUnread(count || 0);
    } catch (err) {
      console.error('Failed to fetch total unread count:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    let isActive = true;
    fetchTotalUnread();

    const channelName = `total-unread-channel_${Date.now()}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          // 2. Add filter so the database ONLY sends this user's messages
          filter: `receiver_id=eq.${userId}`, 
        },
        (payload) => {
          const newMsg = payload.new as any;
          // Receiver check is no longer needed here because of the filter above
          if (isActive && !newMsg.read) {
            setTotalUnread((prev) => prev + 1);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${userId}`,
        },
        (payload) => {
          const updatedMsg = payload.new as any;
          
          if (isActive && updatedMsg.read) {
            // 3. Subtract 1 locally instead of making an expensive database call
            setTotalUnread((prev) => Math.max(0, prev - 1));
          }
        }
      )
      .subscribe();

    return () => {
      isActive = false;
      void supabase.removeChannel(channel);
    };
  }, [userId, fetchTotalUnread]);

  return {
    totalUnread,
    loading,
    refetch: fetchTotalUnread,
  };
}
