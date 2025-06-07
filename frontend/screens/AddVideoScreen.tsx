import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import ApiService, { AddVideoPayload } from '../services/ApiService'; // AddVideoPayload をインポート
import { NavigationProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';

type AddVideoScreenNavigationProp = NavigationProp<RootStackParamList, 'AddVideo'>;

interface Props {
  navigation: AddVideoScreenNavigationProp;
}

export default function AddVideoScreen({ navigation }: Props): JSX.Element {
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [playlistName, setPlaylistName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const isValidYouTubeUrl = (url: string): boolean => {
    const pattern = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    return pattern.test(url);
  };

  const handleAddVideo = async () => {
    if (!isValidYouTubeUrl(videoUrl)) {
      Alert.alert("エラー", "有効な YouTube 動画の URL を入力してください。");
      return;
    }
    if (!playlistName.trim()) {
      Alert.alert("エラー", "プレイリスト名を入力してください。");
      return;
    }

    setLoading(true);
    const payload: AddVideoPayload = {
      playlistName: playlistName.trim(),
      videoUrl: videoUrl.trim(),
    };

    try {
      await ApiService.addVideoToPlaylist(payload);
      Alert.alert("成功", "動画がプレイリストに追加されました。");
      setVideoUrl('');
      setPlaylistName('');
      navigation.goBack();
    } catch (error: any) {
      console.error("動画の追加に失敗:", error);
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
      <Text style={styles.label}>プレイリスト名:</Text>
      <TextInput
        style={styles.input}
        placeholder="例: お気に入り、学習用 (既存または新規)"
        value={playlistName}
        onChangeText={setPlaylistName}
      />
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
  label: { fontSize: 16, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 20,
    borderRadius: 5,
  },
  loader: { marginTop: 20 },
});