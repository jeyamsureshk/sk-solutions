import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Image,
  SafeAreaView,
  TextInput,
  Alert
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

// 1. Updated Interface to include spatial bounding boxes
interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

interface ParsedResult {
  totalCount: number;
  details: string;
  items: BoundingBox[];
}

export default function ComponentScanner() {
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [targetItem, setTargetItem] = useState('screws');
  
  const [parsedResult, setParsedResult] = useState<ParsedResult | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  
  // Track image dimensions to accurately draw boxes
  const [imageLayout, setImageLayout] = useState({ width: 1, height: 1 });
  const cameraRef = useRef<CameraView>(null);

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.message}>We need permission to use the camera.</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const scanAndCount = async () => {
    if (!cameraRef.current) return;
    
    if (!targetItem.trim()) {
      Alert.alert("Missing Target", "Please enter what you want to count.");
      return;
    }

    setLoading(true);
    setParsedResult(null); 
    
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.6 });
      setPhotoUri(photo?.uri || null);
      
      // 2. Updated Prompt for Spatial Recognition
      const prompt = `Carefully scan the image and count the exact number of ${targetItem}. To ensure perfect accuracy, you MUST locate each one individually. Provide the bounding box coordinates (scaled 0 to 1000) for every single ${targetItem} found. Ignore all other objects.`;
      
      const requestBody = {
        contents: [{
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: photo?.base64
              }
            }
          ]
        }],
        // 3. Updated Schema requesting an array of items with coordinates
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              totalCount: { type: "INTEGER" },
              details: { type: "STRING", description: "Brief description of the items found." },
              items: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    ymin: { type: "INTEGER" },
                    xmin: { type: "INTEGER" },
                    ymax: { type: "INTEGER" },
                    xmax: { type: "INTEGER" }
                  },
                  required: ["ymin", "xmin", "ymax", "xmax"]
                }
              }
            },
            required: ["totalCount", "details", "items"]
          }
        }
      };

      const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      if (!API_KEY) throw new Error("API key is missing from your .env file.");

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        }
      );
      
      const data = await response.json();
      
      if (data.candidates && data.candidates.length > 0) {
        const rawJsonString = data.candidates[0].content.parts[0].text;
        const parsedData = JSON.parse(rawJsonString);
        
        // Force the total count to match the actual number of boxes drawn
        parsedData.totalCount = parsedData.items?.length || 0;
        setParsedResult(parsedData);
      } else {
        Alert.alert("Error", "Could not analyze the image. Please try again.");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {photoUri ? (
        <View style={styles.resultContainer}>
          
          {/* 4. Dynamic Image Wrapper for drawing bounding boxes */}
          <View 
            style={styles.imageWrapper}
            onLayout={(e) => setImageLayout(e.nativeEvent.layout)}
          >
            <Image source={{ uri: photoUri }} style={styles.previewImage} />
            
            {/* Draw the numbers on top of the image */}
            {parsedResult?.items?.map((item, i) => {
              // Convert Gemini 0-1000 scale to actual screen pixels
              const top = (item.ymin / 1000) * imageLayout.height;
              const left = (item.xmin / 1000) * imageLayout.width;
              const height = ((item.ymax - item.ymin) / 1000) * imageLayout.height;
              const width = ((item.xmax - item.xmin) / 1000) * imageLayout.width;

              return (
                <View 
                  key={i} 
                  style={[styles.boundingBox, { top, left, width, height }]}
                >
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{i + 1}</Text>
                  </View>
                </View>
              );
            })}
          </View>
          
          <ScrollView style={styles.resultScroll}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.loadingText}>Locating and counting {targetItem}...</Text>
              </View>
            ) : parsedResult ? (
              <View style={styles.parsedCard}>
                <Text style={styles.targetLabel}>Target: {targetItem}</Text>
                <Text style={styles.countText}>{parsedResult.totalCount}</Text>
                <Text style={styles.detailsText}>{parsedResult.details}</Text>
              </View>
            ) : null}
          </ScrollView>

          <TouchableOpacity 
            style={[styles.permissionButton, styles.secondaryButton]} 
            onPress={() => { setPhotoUri(null); setParsedResult(null); }}
            disabled={loading}
          >
            <Text style={styles.buttonText}>Scan Another Area</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.cameraContainer}>
          <CameraView style={styles.camera} ref={cameraRef} facing="back">
            <View style={styles.overlay}>
              <View style={styles.scanFrame} />
            </View>
          </CameraView>
          
          <View style={styles.controls}>
            <TextInput
              style={styles.targetInput}
              value={targetItem}
              onChangeText={setTargetItem}
              placeholder="What should I count? (e.g., screws)"
              placeholderTextColor="#9ca3af"
            />

            <TouchableOpacity style={styles.scanButton} onPress={scanAndCount}>
              <View style={styles.scanButtonInner} />
            </TouchableOpacity>
            <Text style={styles.instructionText}>Center {targetItem} and tap to count</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  message: { textAlign: 'center', paddingBottom: 20, fontSize: 16, color: '#333' },
  
  cameraContainer: { flex: 1 },
  camera: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  scanFrame: { width: 250, height: 250, borderWidth: 2, borderColor: '#3B82F6', borderRadius: 20, backgroundColor: 'transparent' },
  controls: { padding: 30, backgroundColor: '#000', alignItems: 'center', paddingBottom: 50 },
  
  targetInput: {
    backgroundColor: '#1E293B',
    color: '#fff',
    width: '80%',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3B82F6',
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 20,
    fontWeight: '600'
  },
  
  scanButton: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  scanButtonInner: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: '#000' },
  instructionText: { color: '#fff', marginTop: 15, fontSize: 14, fontWeight: '500' },
  
  resultContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  
  // --- New Styles for Image Overlay ---
  imageWrapper: {
    width: '100%',
    aspectRatio: 3/4, // Matches standard camera aspect ratio
    backgroundColor: '#000',
    position: 'relative'
  },
  previewImage: { 
    width: '100%', 
    height: '100%', 
    resizeMode: 'cover' 
  },
  boundingBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#22C55E', // Bright green box
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  badge: {
    position: 'absolute',
    top: -10,
    left: -10,
    backgroundColor: '#22C55E',
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  // -----------------------------------

  resultScroll: { flex: 1, padding: 20 },
  loadingContainer: { alignItems: 'center', marginTop: 40, gap: 12 },
  loadingText: { color: '#64748B', fontSize: 16, fontWeight: '600' },
  
  parsedCard: {
    backgroundColor: '#ffffff',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
  },
  targetLabel: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  countText: {
    fontSize: 64,
    fontWeight: '900',
    color: '#3B82F6',
    marginBottom: 16,
  },
  detailsText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 22,
    textAlign: 'center',
  },
  
  permissionButton: { backgroundColor: '#3B82F6', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
  secondaryButton: { margin: 20, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
