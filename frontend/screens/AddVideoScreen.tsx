import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import ApiService, { AddVideoPayload } from '../services/ApiService'; // AddVideoPayload をインポート
import { NavigationProp } from '@react-navigation/native';
import { RootStackParamList, Playlist } from '../types';

type AddVideoScreenNavigationProp = NavigationProp<RootStackParamList, 'AddVideo'>;

interface Props {
  navigation: AddVideoScreenNavigationProp;
}

export default function AddVideoScreen({ navigation }: Props): JSX.Element {
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [videoTitle, setVideoTitle] = useState<string>('');
  const [playlistName, setPlaylistName] = useState<string>(''); // For the text input, can be populated by picker or typed
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylistName, setSelectedPlaylistName] = useState<string>(''); // For Picker's selected value
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const fetchPlaylists = async () => {
      try {
        const fetchedPlaylists = await ApiService.getPlaylists();
        setPlaylists(fetchedPlaylists);
      } catch (error) {
        console.error("Failed to fetch playlists:", error);
        Alert.alert("エラー", "プレイリストの読み込みに失敗しました。");
      }
    };
    fetchPlaylists();
  }, []);

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
      videoTitle: videoTitle.trim() || undefined, // Send undefined if empty
    };

    try {
      await ApiService.addVideoToPlaylist(payload);
      Alert.alert("成功", "動画がプレイリストに追加されました。");
      setVideoUrl('');
      setVideoTitle('');
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
      <Text style={styles.label}>動画のタイトル (任意):</Text>
      <TextInput
        style={styles.input}
        placeholder="例: 面白い猫の動画"
        value={videoTitle}
        onChangeText={setVideoTitle}
      />

      <Text style={styles.label}>プレイリストを選択または新規作成:</Text>
      <Picker
        selectedValue={selectedPlaylistName}
        onValueChange={(itemValue, itemIndex) => {
          setSelectedPlaylistName(itemValue);
          if (itemValue) {
            setPlaylistName(itemValue); // Update the text input as well
          }
        }}
        style={styles.picker}
      >
        <Picker.Item label="既存のプレイリストを選択..." value="" />
        {playlists.map((p) => (
          <Picker.Item key={p.playlistId} label={p.name} value={p.name} />
        ))}
      </Picker>

      <Text style={styles.label}>プレイリスト名 (新規または選択済み):</Text>
      <TextInput
        style={styles.input}
        placeholder="例: お気に入り、学習用"
        value={playlistName} // This is the value submitted
        onChangeText={text => {
          setPlaylistName(text);
          // If user types, deselect from picker if text doesn't match any existing playlist name
          if (!playlists.find(p => p.name === text)) {
              setSelectedPlaylistName("");
          } else {
              setSelectedPlaylistName(text); // Reselect picker if text input matches
          }
        }}
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
  picker: {
    borderWidth: 1,
    borderColor: '#ccc',
    marginBottom: 20,
    borderRadius: 5,
  },
  loader: { marginTop: 20 },
});