import React, { useEffect, useState } from 'react';
import {
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  View,
  TextInput,
} from 'react-native';
import { Search } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useOperators } from '@/hooks/useOperators';
import { useProfiles } from '@/hooks/useProfiles';
import { useUnreadCounts } from '@/hooks/useUnreadCounts';
import { useLastMessages } from '@/hooks/useLastMessages';
import { supabase } from '@/lib/supabase';

export default function MessagesIndex() {
  const router = useRouter();
  const { operators } = useOperators();
  const { profiles } = useProfiles();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const { unreadCounts, refetch: refetchUnreadCounts } = useUnreadCounts(currentUserId || undefined);
  const { lastMessages, refetch: refetchLastMessages } = useLastMessages(currentUserId || undefined);

  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        setCurrentUserEmail(user.email ?? null);
      }
    };
    fetchUser();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!currentUserId) return;
      refetchUnreadCounts();
      refetchLastMessages();
    }, [currentUserId, refetchUnreadCounts, refetchLastMessages])
  );

  const validOperators = operators.filter(op =>
    profiles.some(p => p.email === op.email) &&
    op.email !== currentUserEmail
  );

  const filteredOperators = validOperators
  .filter(op =>
    op.name.toLowerCase().includes(searchQuery.toLowerCase())
  )
  .sort((a, b) => {
    const profileA = profiles.find(p => p.email === a.email);
    const profileB = profiles.find(p => p.email === b.email);

    const lastTimeA = profileA ? lastMessages[profileA.id]?.created_at || '' : '';
    const lastTimeB = profileB ? lastMessages[profileB.id]?.created_at || '' : '';

    // ✅ If both have last message times, sort descending (latest first)
    if (lastTimeA && lastTimeB) {
      return new Date(lastTimeB).getTime() - new Date(lastTimeA).getTime();
    }

    // If only one has a last message, put the one with a time first
    if (lastTimeA && !lastTimeB) return -1;
    if (!lastTimeA && lastTimeB) return 1;

    // Fallback: sort by name
    return a.name.localeCompare(b.name);
  });



  const handlePress = (opEmail: string) => {
    const profile = profiles.find(p => p.email === opEmail);
    if (!profile) return;
    router.push(`/messages/${profile.id}`);
  };

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.searchContainer}>
        <Search size={18} color="#667781" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search"
          placeholderTextColor="#667781"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {filteredOperators.map(op => {
          const profile = profiles.find(p => p.email === op.email);
          const unreadCount = profile ? unreadCounts[profile.id] || 0 : 0;
          const lastMessage = profile ? lastMessages[profile.id]?.content || '' : '';
          const lastTime = profile ? lastMessages[profile.id]?.created_at || '' : '';

          return (
            <TouchableOpacity
              key={op.email}
              style={styles.memberCard}
              activeOpacity={0.7}
              onPress={() => handlePress(op.email)}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{op.name.charAt(0)}</Text>
              </View>

              <View style={styles.textContainer}>
                <View style={styles.nameRow}>
                  <Text style={[styles.memberName, unreadCount > 0 && styles.unreadName]} numberOfLines={1}>
                    {op.name}
                  </Text>
                  {lastTime !== '' && (
                    <Text style={[styles.timeText, unreadCount > 0 && styles.unreadTime]}>
                      {formatTime(lastTime)}
                    </Text>
                  )}
                </View>
                <View style={styles.previewRow}>
                  {lastMessage !== '' ? (
                    <Text style={styles.lastMessage} numberOfLines={1}>
                      {lastMessage}
                    </Text>
                  ) : <View style={styles.lastMessage} />}
                  {unreadCount > 0 && (
                    <View style={styles.badgeInline}>
                      <Text style={styles.badgeText}>{unreadCount}</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff', marginTop: -35 },
  searchContainer: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f2f5',
    borderRadius: 10,
    paddingHorizontal: 14,
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 4,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 10,
    fontSize: 15,
    color: '#111b21',
  },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 12, paddingTop: 4, paddingBottom: 12 },

  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 76,
    paddingVertical: 10,
    paddingHorizontal: 4,
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e9edef',
  },

  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#d9fdd3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 13,
  },
  avatarText: {
    color: '#075e54',
    fontSize: 20,
    fontWeight: '700',
  },

  textContainer: { flex: 1 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  memberName: { flex: 1, fontSize: 16, fontWeight: '500', color: '#111b21' },
  unreadName: { fontWeight: '700' },
  previewRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  lastMessage: { flex: 1, fontSize: 14, color: '#667781' },
  timeText: { fontSize: 11, color: '#667781', marginLeft: 8 },
  unreadTime: { color: '#00a884' },
  badgeInline: {
    backgroundColor: '#25d366',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
});

