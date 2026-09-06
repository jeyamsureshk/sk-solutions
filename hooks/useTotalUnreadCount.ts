import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useTotalUnreadCount(userId?: string) {
  const [totalUnread, setTotalUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    let isActive = true;
    fetchTotalUnread();
    const channelName = `total-unread-channel_${Date.now()}`;
    const existingChannel = supabase
      .getChannels()
      .find((registeredChannel) => registeredChannel.topic === `realtime:${channelName}`);
    if (existingChannel) void supabase.removeChannel(existingChannel);

    // Subscribe to realtime changes
    const channel = supabase
      .channel(channelName)
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
          if (isActive && newMsg.receiver_id === userId && !newMsg.read) {
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
        },
        (payload) => {
          const updatedMsg = payload.new as any;
          // If a message was marked as read by the current user
          if (isActive && updatedMsg.receiver_id === userId && updatedMsg.read) {
            fetchTotalUnread(); // Refetch total count
          }
        }
      )
      .subscribe();

    return () => {
      isActive = false;
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const fetchTotalUnread = async () => {
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
  };

  return {
    totalUnread,
    loading,
    refetch: fetchTotalUnread,
  };
}
