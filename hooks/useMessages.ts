import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Message, MessageInsert } from '@/types/database';

export function useMessages(userId?: string, partnerId?: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !partnerId) return;

    // Load initial messages
    fetchMessages();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('messages-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMsg = payload.new as Message;
          // Only add if it's between current user and partner
          if (
            (newMsg.sender_id === userId && newMsg.receiver_id === partnerId) ||
            (newMsg.sender_id === partnerId && newMsg.receiver_id === userId)
          ) {
            setMessages((prev) => [...prev, newMsg]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, partnerId]);

  const fetchMessages = async () => {
    if (!userId || !partnerId) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(
          `and(sender_id.eq.${userId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${userId})`
        )
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch messages');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (
    message: MessageInsert
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.from('messages').insert(message);
      if (error) throw error;
      // Message will arrive via subscription
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to send message',
      };
    }
  };

  const markAsRead = async (
    messageId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ read: true })
        .eq('id', messageId)
        .eq('receiver_id', userId);

      if (error) throw error;

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, read: true } : msg
        )
      );

      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to mark as read',
      };
    }
  };

  return {
    messages,
    loading,
    error,
    fetchMessages,
    sendMessage,
    markAsRead,
  };
}

