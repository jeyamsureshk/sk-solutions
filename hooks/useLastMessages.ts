// hooks/useLastMessages.ts
import { useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

type LastMessage = {
  content: string;
  created_at: string;
};

const getCacheKey = (userId: string) => `messages:last:${userId}`;

export function useLastMessages(userId?: string) {
  const [lastMessages, setLastMessages] = useState<Record<string, LastMessage>>({});

  const fetchLastMessages = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from('messages')
      .select('id, content, sender_id, receiver_id, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    const map: Record<string, LastMessage> = {};
    data.forEach(msg => {
      if (msg.sender_id !== userId && msg.receiver_id !== userId) return;
      const otherId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
      if (!map[otherId]) {
        map[otherId] = { content: msg.content, created_at: msg.created_at };
      }
    });
    setLastMessages(map);
    await AsyncStorage.setItem(getCacheKey(userId), JSON.stringify(map));
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setLastMessages({});
      return;
    }

    AsyncStorage.getItem(getCacheKey(userId)).then((cached) => {
      if (!cached) return;
      try {
        setLastMessages(JSON.parse(cached) as Record<string, LastMessage>);
      } catch {
        AsyncStorage.removeItem(getCacheKey(userId));
      }
    });

    fetchLastMessages();

    const channel = supabase
      .channel(`last-messages-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const message = payload.new as {
            content: string;
            sender_id: string;
            receiver_id: string;
            created_at: string;
          };

          if (message.sender_id !== userId && message.receiver_id !== userId) return;

          const otherId = message.sender_id === userId ? message.receiver_id : message.sender_id;
          setLastMessages((previous) => {
            const current = previous[otherId];
            if (current && new Date(current.created_at).getTime() >= new Date(message.created_at).getTime()) {
              return previous;
            }

            return {
              ...previous,
              [otherId]: { content: message.content, created_at: message.created_at },
            };
          });
          AsyncStorage.mergeItem(
            getCacheKey(userId),
            JSON.stringify({
              [otherId]: { content: message.content, created_at: message.created_at },
            })
          );
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          const message = payload.new as { sender_id: string; receiver_id: string };
          if (message.sender_id === userId || message.receiver_id === userId) fetchLastMessages();
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages' },
        () => fetchLastMessages(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchLastMessages]);

  return { lastMessages, refetch: fetchLastMessages };
}

