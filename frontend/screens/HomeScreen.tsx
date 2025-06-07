import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, Button, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import ApiService from '../services/ApiService';
import { useFocusEffect, NavigationProp } from '@react-navigation/native';
import { Playlist, RootStackParamList } from '../types'; // 型定義をインポート

type HomeScreenNavigationProp = NavigationProp<RootStackParamList, 'Home'>;

interface Props {
  navigation: HomeScreenNavigationProp;
}

export default function HomeScreen({ navigation }: Props): JSX.Element {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlaylists = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ApiService.getPlaylists();
      setPlaylists(data);
    } catch (err) {
      console.error("プレイリストの取得に失敗:", err);
      setError("プレイリストの取得に失敗しました。");
      setPlaylists([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchPlaylists();
    }, [])
  );

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" /></View>;
  }

  if (error) {
    return <View style={styles.centered}><Text style={styles.errorText}>{error}</Text><Button title="再試行" onPress={fetchPlaylists} /></View>;
  }
  console.log("Playlists data for FlatList:", JSON.stringify(playlists, null, 2)); // FlatListの直前に追加
  return (
    <View style={styles.container}>
      {playlists.length === 0 && !loading && (
        <Text style={styles.emptyText}>プレイリストがありません。新しい動画を追加してプレイリストを作成しましょう！</Text>
      )}
      <FlatList<Playlist>
        data={playlists}
        keyExtractor={(item, index) => {
          if (item && typeof item.playlistId === 'string' && item.playlistId.length > 0) {
            return item.playlistId;
          }
          // Log an error or warning if playlistId is missing or invalid
          console.warn(`Missing or invalid playlistId for item at index ${index}. Using index as fallback key.`);
          return `playlist-fallback-${index}`; // Fallback key
        }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.playlistItem}
            onPress={() => navigation.navigate('PlaylistDetail', { playlist: item })}
          >
            <Text style={styles.playlistName}>{item.name || `プレイリスト ${item.playlistId}`}</Text>
            <Text style={styles.videoCount}>{item.videos ? item.videos.length : 0} 本の動画</Text>
          </TouchableOpacity>
        )}
      />
      <Button
        title="新しい動画を追加"
        onPress={() => navigation.navigate('AddVideo')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: 'red', marginBottom: 10 },
  emptyText: { textAlign: 'center', marginTop: 20, fontSize: 16, color: 'gray' },
  playlistItem: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    marginVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  playlistName: { fontSize: 18, fontWeight: 'bold' },
  videoCount: { fontSize: 14, color: 'gray', marginTop: 5 },
});
