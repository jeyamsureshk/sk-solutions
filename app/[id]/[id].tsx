import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Modal,
  StatusBar,
  Easing,
  Keyboard,
  ImageBackground, // Added ImageBackground
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import uuid from 'react-native-uuid';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Message, MessageInsert } from '@/types/database';
import { LinearGradient } from 'expo-linear-gradient';
import { useAudioPlayer } from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';

import sendSoundFile from '@/assets/sounds/send.mp3';
import receiveSoundFile from '@/assets/sounds/receive.mp3';

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  const today = new Date();
  const diffTime = today.getTime() - date.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
};

type DateSeparator = { type: 'date'; date: string };
type ListItem = Message | DateSeparator;

interface BackgroundOption {
  type: 'solid' | 'gradient' | 'custom' | 'doodle'; // Added doodle type
  color?: string;
  colors?: string[];
}

const getChatCacheKey = (userId: string, partnerId: string) =>
  `messages:chat:${[userId, partnerId].sort().join(':')}`;

// WhatsApp classic doodle pattern (Transparent PNG)
const WA_DOODLE_URL = 'https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png';

export default function ChatScreen() {
  const { id: partnerId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState<string>('Chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Set default background to the WhatsApp doodle
  const [background, setBackground] = useState<BackgroundOption>({ 
    type: 'doodle' 
  });
  
  const [modalVisible, setModalVisible] = useState(false);
  const [customColor1, setCustomColor1] = useState('#ff0000');
  const [customColor2, setCustomColor2] = useState('#efefef');

  const [notifMessage, setNotifMessage] = useState('');
  const notifAnim = useRef(new Animated.Value(-150)).current; 
  const sendSound = useAudioPlayer(sendSoundFile);
  const receiveSound = useAudioPlayer(receiveSoundFile);

  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => {
        setKeyboardVisible(true);
        setKeyboardHeight(event.endCoordinates.height);
      }
    );

    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
        setKeyboardHeight(0);
      }
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (isKeyboardVisible) {
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [isKeyboardVisible]);

  const showNewMessageNotification = (msgContent: string) => {
    setNotifMessage(msgContent);
    Animated.timing(notifAnim, {
      toValue: insets.top + 10,
      duration: 400,
      easing: Easing.out(Easing.back(1.5)),
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      Animated.timing(notifAnim, {
        toValue: -150,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setNotifMessage(''));
    }, 3000);
  };

  const listItems = useMemo(() => {
    const items: ListItem[] = [];
    let lastDate = '';
    messages.forEach((msg) => {
      const msgDate = new Date(msg.created_at).toDateString();
      if (msgDate !== lastDate) {
        items.push({ type: 'date', date: msg.created_at });
        lastDate = msgDate;
      }
      items.push(msg);
    });
    return items;
  }, [messages]);

  const listRef = useRef<FlatList<ListItem>>(null);
  const animMap = useRef<Record<string, Animated.Value>>({});
  const channelRef = useRef<any>(null);

  const playSound = (sound: ReturnType<typeof useAudioPlayer>) => {
    sound.seekTo(0);
    sound.play();
  };

  useEffect(() => {
    const loadBackground = async () => {
      const stored = await AsyncStorage.getItem('chatBackground');
      if (stored) setBackground(JSON.parse(stored));
    };
    loadBackground();
  }, []);

  useEffect(() => {
    let isActive = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !isActive) return;

      const channelName = `messages-${user.id}-${partnerId}`;
      const existingChannel = supabase
        .getChannels()
        .find((registeredChannel) => registeredChannel.topic === `realtime:${channelName}`);
      if (existingChannel) await supabase.removeChannel(existingChannel);

      setCurrentUserId(user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', partnerId)
        .single();
      if (profile && 'full_name' in profile) setPartnerName(profile.full_name as string);

      await supabase
        .from('messages')
        .update({ read: true })
        .eq('receiver_id', user.id)
        .eq('sender_id', partnerId)
        .eq('read', false);         

      const chatCacheKey = getChatCacheKey(user.id, partnerId);
      const cachedMessages = await AsyncStorage.getItem(chatCacheKey);
      if (cachedMessages && isActive) {
        try {
          setMessages(JSON.parse(cachedMessages) as Message[]);
        } catch {
          await AsyncStorage.removeItem(chatCacheKey);
        }
      }

      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      const fetchedMessages = (data as Message[]) || [];
      if (!isActive) return;
      setMessages(fetchedMessages);
      await AsyncStorage.setItem(chatCacheKey, JSON.stringify(fetchedMessages));

      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);

      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages' },
          async (payload) => {
            const msg = payload.new as Message;
            if (!animMap.current[msg.id]) animMap.current[msg.id] = new Animated.Value(0);
            
            setMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
            const cached = await AsyncStorage.getItem(chatCacheKey);
            const cachedMessages = cached ? (JSON.parse(cached) as Message[]) : [];
            if (!cachedMessages.some((item) => item.id === msg.id)) {
              await AsyncStorage.setItem(chatCacheKey, JSON.stringify([...cachedMessages, msg]));
            }

            if (msg.sender_id === partnerId) {
              playSound(receiveSound);
              showNewMessageNotification(msg.content);
              await supabase.from('messages').update({ read: true }).eq('id', msg.id);
            }

            setTimeout(() => {
              listRef.current?.scrollToEnd({ animated: true });
              Animated.timing(animMap.current[msg.id], {
                toValue: 1,
                duration: 350,
                useNativeDriver: true,
              }).start();
            }, 100);
          }
        )
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'messages' },
            async (payload) => {
              const updatedMsg = payload.new as Message;
              setMessages((prev) => 
                prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m))
              );
              const cached = await AsyncStorage.getItem(chatCacheKey);
              const cachedMessages = cached ? (JSON.parse(cached) as Message[]) : [];
              await AsyncStorage.setItem(
                chatCacheKey,
                JSON.stringify(cachedMessages.map((message) => message.id === updatedMsg.id ? updatedMsg : message))
              );
            }
        )
        .subscribe();

      if (!isActive && channel) {
        await supabase.removeChannel(channel);
        channel = null;
      } else {
        channelRef.current = channel;
      }
    };

    init();

    return () => {
      isActive = false;
      if (channel) supabase.removeChannel(channel);
      if (channelRef.current === channel) channelRef.current = null;
    };
  }, [partnerId]);

   const handleSend = async () => {
    const messageText = text.trim();
    if (!currentUserId || !partnerId || !messageText) return;

    const newId = uuid.v4() as string;
    const optimistic: Message = {
      id: newId,
      sender_id: currentUserId,
      receiver_id: partnerId as string,
      content: messageText,
      read: false,
      created_at: new Date().toISOString(),
    };

    animMap.current[optimistic.id] = new Animated.Value(0);
    
    setMessages((prev) => [...prev, optimistic]);
    setText('');
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    
    Animated.timing(animMap.current[optimistic.id], { 
      toValue: 1, 
      duration: 300, 
      useNativeDriver: true 
    }).start();

    playSound(sendSound);

    const { error } = await supabase.from('messages').insert(optimistic as MessageInsert);
    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      Alert.alert('Error', 'Failed to send message');
    }
  };

  const handleDeleteSelected = async () => {
    Alert.alert('Delete Messages', `Delete ${selectedIds.length} selected message(s)?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.from('messages').delete({ count: 'exact' }).in('id', selectedIds);
            if (!error) {
               setMessages((prev) => prev.filter((m) => !selectedIds.includes(m.id)));
               setSelectedIds([]);
            }
          } catch (err) { console.error(err); }
        },
      },
    ]);
  };

  const toggleSelect = (messageId: string) => {
    setSelectedIds((prev) =>
      prev.includes(messageId)
        ? prev.filter((id) => id !== messageId)
        : [...prev, messageId]
    );
  };

  const backgroundOptions: BackgroundOption[] = [
    { type: 'doodle' },
    { type: 'custom' },
    { type: 'solid', color: '#efe7de' },
    { type: 'gradient', colors: ['#e0c3fc', '#8ec5fc'] },
    { type: 'gradient', colors: ['#ffff00', '#ffffff'] },
    { type: 'solid', color: '#1a1a1a' },
  ];

  const renderDateSeparator = (dateStr: string) => (
    <View style={styles.dateSeparator}>
      <Text style={styles.dateSeparatorText}>{formatDate(dateStr)}</Text>
    </View>
  );

  const renderMessage = (item: Message) => {
    const isMine = item.sender_id === currentUserId;
    const isSelected = selectedIds.includes(item.id);
    if (!animMap.current[item.id]) animMap.current[item.id] = new Animated.Value(1);

    // WhatsApp exact bubble colors
    const backgroundColor = isSelected 
      ? 'rgba(252, 165, 165, 0.8)' 
      : isMine 
        ? '#d9fdd3' 
        : '#ffffff';

    return (
      <Animated.View style={[styles.messageRow, isMine ? styles.rowRight : styles.rowLeft, { opacity: animMap.current[item.id] }]}>
        <TouchableOpacity
          onLongPress={() => toggleSelect(item.id)}
          onPress={() => selectedIds.length > 0 && toggleSelect(item.id)}
          activeOpacity={0.8}
          style={{ maxWidth: '80%' }}
        >
          <View
            style={[
              styles.bubble, 
              isMine ? styles.bubbleRight : styles.bubbleLeft, 
              { backgroundColor }
            ]}
          >
            <View style={styles.bubbleContent}>
              <Text style={styles.messageText}>
                {item.content + "  "}
              </Text>
              <View style={styles.metaContainer}>
                <Text style={styles.timeText}>
                  {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) + " "}   
                </Text>
                {isMine && (
                  <Ionicons
                    name={item.read ? 'checkmark-done' : 'checkmark'} // Switched to WhatsApp style checkmarks
                    size={15}
                    color={item.read ? "red" : "#8696a0"} // WhatsApp blue ticks vs grey ticks
                    style={{ marginLeft: 2 }}
                  />
                )}
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderItem = ({ item }: { item: ListItem }) => {
    if ('type' in item && item.type === 'date') return renderDateSeparator(item.date);
    return renderMessage(item as Message);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Background Rendering Logic */}
      {background.type === 'doodle' ? (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#efe7de' }]}>
          <ImageBackground 
            source={{ uri: WA_DOODLE_URL }} 
            style={[StyleSheet.absoluteFillObject, { opacity: 0.4 }]} 
            resizeMode="repeat" 
          />
        </View>
      ) : background.type === 'gradient' && background.colors ? (
        <LinearGradient colors={background.colors} style={StyleSheet.absoluteFillObject} />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: background.color || '#fff' }]} />
      )}

      {/* Header */}
      <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={['#075e54', '#128c7e']}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>{partnerName}</Text>
            <Text style={styles.headerSubtitle}>online</Text>
          </View>
          {selectedIds.length > 0 ? (
            <TouchableOpacity onPress={handleDeleteSelected} style={styles.headerButton}>
              <Ionicons name="trash-outline" size={24} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.headerButton}>
              <Ionicons name="color-palette-outline" size={24} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Notification Banner */}
      <Animated.View 
        style={[
          styles.notificationBanner, 
          { transform: [{ translateY: notifAnim }] }
        ]}
      >
        <View style={styles.notificationContent}>
            <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
            <View style={{marginLeft: 10, flex: 1}}>
                <Text style={styles.notificationTitle}>{partnerName}</Text>
                <Text style={styles.notificationText} numberOfLines={1}>
                    {notifMessage}
                </Text>
            </View>
        </View>
      </Animated.View>

      <View style={{ flex: 1 }}>
        <FlatList
          ref={listRef}
          data={listItems}
          keyExtractor={(item) => ('type' in item ? item.date : (item as Message).id)}
          renderItem={renderItem}
          contentContainerStyle={[styles.listContent, { paddingBottom: 15 }]}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
        />

        {/* WhatsApp Style Input Container */}
        <View
          style={[
            styles.inputContainer,
            {
              marginBottom: Platform.OS === 'android' ? keyboardHeight : 0,
              paddingBottom: isKeyboardVisible ? 10 : Math.max(insets.bottom, 10),
            },
          ]}
        >
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              value={text}
              onChangeText={setText}
              placeholder="Message"
              placeholderTextColor="#8696a0"
              multiline
            />
          </View>
          
          <TouchableOpacity 
            onPress={handleSend}
            disabled={!text.trim()}
            style={[styles.sendButton, !text.trim() && styles.sendButtonDisabled]}
          >
            <Ionicons name="send" size={20} color="#fff" style={{ marginLeft: 2 }} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Modal */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalVisible(false)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalHeader}>Appearance</Text>
            <FlatList
              data={backgroundOptions}
              numColumns={4}
              keyExtractor={(_, i) => i.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.swatchContainer}
                  onPress={() => {
                    const bg = item.type === 'custom' ? { type: 'gradient', colors: [customColor1, customColor2] } : item;
                    setBackground(bg as BackgroundOption);
                    AsyncStorage.setItem('chatBackground', JSON.stringify(bg));
                    setModalVisible(false);
                  }}
                >
                  {item.type === 'doodle' ? (
                    <View style={[styles.swatch, { backgroundColor: '#efe7de', borderWidth: 1, borderColor: '#ddd' }]}>
                       <Ionicons name="logo-whatsapp" size={24} color="#128c7e" />
                    </View>
                  ) : item.type === 'gradient' ? (
                     <LinearGradient colors={item.colors!} style={styles.swatch} />
                  ) : item.type === 'custom' ? (
                    <LinearGradient colors={[customColor1, customColor2]} style={styles.swatch}><Ionicons name="add" size={20} color="#fff"/></LinearGradient>
                  ) : (
                    <View style={[styles.swatch, { backgroundColor: item.color, borderWidth: 1, borderColor: '#ddd' }]} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#efe7de',
  },
  
  notificationBanner: {
    position: 'absolute',
    left: 15,
    right: 15,
    zIndex: 100,
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  notificationTitle: {
    color: '#3b82f6', 
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 2,
  },
  notificationText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },

  // Header
  headerContainer: {
    width: '100%',
    zIndex: 10,    backgroundColor: 'rgba(200,67,95,1)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  headerButton: {
    padding: 8,
    borderRadius: 20,
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 5,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '600',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },

  listContent: {
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  dateSeparator: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  dateSeparatorText: {
    color: '#54656f',
    fontSize: 12,
    fontWeight: '500',
  },

  // Messages (WhatsApp Style)
  messageRow: {
    marginBottom: 4,
    width: '100%',
  },
  rowLeft: {
    alignItems: 'flex-start',
  },
  rowRight: {
    alignItems: 'flex-end',
  },
  bubble: {
    borderRadius: 14,
    paddingTop: 6,
    paddingBottom: 6,
    paddingHorizontal: 10,
    minWidth: 80,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  // Creates the classic WhatsApp sharp corner tail effect
  bubbleLeft: {
    borderTopLeftRadius: 0, 
    marginLeft: 5,
  },
  bubbleRight: {
    borderTopRightRadius: 0,
    marginRight: 5,
  },
  
  bubbleContent: {
    flexDirection: 'column',
    alignItems: 'flex-start', 
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: -2, 
  },
  messageText: {
    fontSize: 15.5,
    lineHeight: 22,
    color: '#111b21',
    marginRight: 20, 
    paddingBottom: 2,
  },
  timeText: {
    fontSize: 11,
    color: '#667781',
  },

  // WhatsApp Style Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingTop: 5,
    backgroundColor: 'transparent',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#fff',
    borderRadius: 24,
    minHeight: 45,
    maxHeight: 120,
    marginRight: 8, // Space between input and send button
    paddingHorizontal: 12,
    paddingVertical: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#111b21',
    paddingTop: 8,
    paddingBottom: 8,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f00', // WhatsApp send button color
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  sendButtonDisabled: {
    backgroundColor: '#f00', 
    opacity: 0.5,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
  },
  modalHeader: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 20,
    textAlign: 'center',
  },
  swatchContainer: {
    flex: 1,
    aspectRatio: 1,
    margin: 6,
  },
  swatch: {
    flex: 1,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
