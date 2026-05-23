import React from 'react';

import {
  View,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

import { WebView } from 'react-native-webview';

const THEME = {
  accent: '#2563eb',
  bg: '#F8FAFC',
};

type Props = {
  searchQuery: string;
};

export default function WebTab({
  searchQuery,
}: Props) {
const query = searchQuery || '';

const googleSearchUrl =
  query.trim().length > 0
    ? `https://www.google.com/search?q=${encodeURIComponent(
        query
      )}`
    : 'https://www.google.com';
  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: googleSearchUrl }}
        style={styles.webView}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        showsVerticalScrollIndicator={false}
        renderLoading={() => (
          <View style={styles.loader}>
            <ActivityIndicator
              size="large"
              color={THEME.accent}
            />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.bg,
  },

  webView: {
    flex: 1,
  },

  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
