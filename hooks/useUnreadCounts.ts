import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useUnreadCounts(userId?: string) {
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    fetchUnreadCounts();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('unread-counts-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMsg = payload.new as any;
          // Only update if the message is for the current user and unread
          if (newMsg.receiver_id === userId && !newMsg.read) {
            setUnreadCounts((prev) => ({
              ...prev,
              [newMsg.sender_id]: (prev[newMsg.sender_id] || 0) + 1,
            }));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const updatedMsg = payload.new as any;
          // If a message was marked as read by the current user
          if (updatedMsg.receiver_id === userId && updatedMsg.read) {
            fetchUnreadCounts(); // Refetch all counts
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const fetchUnreadCounts = async () => {
    if (!userId) return;

    try {
      setLoading(true);

      // Get all unread messages grouped by sender
      const { data, error } = await supabase
        .from('messages')
        .select('sender_id')
        .eq('receiver_id', userId)
        .eq('read', false);

      if (error) throw error;

      // Count messages per sender
      const counts: Record<string, number> = {};
      data?.forEach((msg) => {
        counts[msg.sender_id] = (counts[msg.sender_id] || 0) + 1;
      });

      setUnreadCounts(counts);
    } catch (err) {
      console.error('Failed to fetch unread counts:', err);
    } finally {
      setLoading(false);
    }
  };

  return {
    unreadCounts,
    loading,
    refetch: fetchUnreadCounts,
  };
}
