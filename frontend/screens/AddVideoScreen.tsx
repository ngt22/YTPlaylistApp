import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import ApiService, { AddVideoPayload } from '../services/ApiService'; // AddVideoPayload をインポート
import { NavigationProp, RouteProp } from '@react-navigation/native'; // Added RouteProp
import { RootStackParamList } from '../types'; // Playlist type might not be needed anymore

type AddVideoScreenNavigationProp = NavigationProp<RootStackParamList, 'AddVideo'>;
type AddVideoScreenRouteProp = RouteProp<RootStackParamList, 'AddVideo'>; // Added

interface Props {
  navigation: AddVideoScreenNavigationProp;
  route: AddVideoScreenRouteProp; // Added route
}

export default function AddVideoScreen({ navigation, route }: Props): JSX.Element {
  const playlistIdFromRoute = route.params?.playlistId;
  const playlistNameFromRoute = route.params?.playlistName;

  const [videoUrl, setVideoUrl] = useState<string>('');
  const [videoTitle, setVideoTitle] = useState<string>('');
  // Removed playlistName, playlists, selectedPlaylistName state variables
  const [loading, setLoading] = useState<boolean>(false);

  // Removed useEffect that fetches playlists

  const isValidYouTubeUrl = (url: string): boolean => {
    const pattern = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    return pattern.test(url);
  };

  const handleAddVideo = async () => {
    if (!isValidYouTubeUrl(videoUrl)) {
      Alert.alert("エラー", "有効な YouTube 動画の URL を入力してください。");
      return;
    }
    if (!playlistIdFromRoute) {
      Alert.alert("エラー", "プレイリスト情報が見つかりません。動画を追加するプレイリストを指定してください。");
      return;
    }

    setLoading(true);
    // Note: AddVideoPayload type in ApiService/types should be updated to:
    // { playlistId: string; videoUrl: string; videoTitle?: string; }
    const payload = { // Type assertion can be used if AddVideoPayload is updated elsewhere
      playlistId: playlistIdFromRoute,
      videoUrl: videoUrl.trim(),
      videoTitle: videoTitle.trim() || undefined,
    };

    try {
      await ApiService.addVideoToPlaylist(payload as AddVideoPayload); // Using 'as' for now
      Alert.alert("成功", `動画がプレイリスト「${playlistNameFromRoute || '選択されたプレイリスト'}」に追加されました。`);
      setVideoUrl('');
      setVideoTitle('');
      // playlistName state removed
      navigation.goBack();
    } catch (error: any) {
      console.error("動画の追加に失敗:", error);
      // Ensure playlistNameFromRoute is used in the error message if available
      Alert.alert("エラー", `動画の追加に失敗しました: ${error.message || 'サーバーエラー'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>YouTube 動画 URL:</Text>
      <TextInput
        style={styles.input}
        placeholder="https://www.youtube.com/watch?v=..."
        value={videoUrl}
        onChangeText={setVideoUrl}
        keyboardType="url"
        autoCapitalize="none"
      />
      <Text style={styles.label}>動画のタイトル (任意):</Text>
      <TextInput
        style={styles.input}
        placeholder="例: 面白い猫の動画"
        value={videoTitle}
        onChangeText={setVideoTitle}
      />

      {playlistNameFromRoute && (
        <Text style={styles.playlistInfoText}>
          追加先のプレイリスト: <Text style={styles.playlistNameHighlight}>{playlistNameFromRoute}</Text>
        </Text>
      )}

      {/* Picker and playlist name TextInput removed */}

      {loading ? (
        <ActivityIndicator size="large" style={styles.loader} />
      ) : (
        <Button title="動画を追加" onPress={handleAddVideo} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  label: { fontSize: 16, marginBottom: 8, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 15, // Adjusted margin
    borderRadius: 5,
  },
  // picker style removed
  loader: { marginTop: 20 },
  playlistInfoText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  playlistNameHighlight: {
    fontWeight: 'bold',
    color: '#007AFF', // Or your app's theme color
  }
});