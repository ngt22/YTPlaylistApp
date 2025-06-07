import React from 'react';
import { View, Text, FlatList, StyleSheet, Button, Linking, Alert, TouchableOpacity } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import ApiService, { RemoveVideoPayload } from '../services/ApiService'; // RemoveVideoPayload をインポート
import { RouteProp, NavigationProp } from '@react-navigation/native';
import { RootStackParamList, Playlist, Video } from '../types';

type PlaylistDetailScreenRouteProp = RouteProp<RootStackParamList, 'PlaylistDetail'>;
type PlaylistDetailScreenNavigationProp = NavigationProp<RootStackParamList, 'PlaylistDetail'>;

interface Props {
  route: PlaylistDetailScreenRouteProp;
  navigation: PlaylistDetailScreenNavigationProp;
}

export default function PlaylistDetailScreen({ route, navigation }: Props): JSX.Element {
  const { playlist } = route.params;

  const openVideo = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert("エラー", `このURLを開けません: ${url}`);
        // await WebBrowser.openBrowserAsync(url);
      }
    } catch (error: any) {
      Alert.alert("エラー", `動画を開けませんでした: ${error.message}`);
      console.error("Failed to open video", error);
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    Alert.alert(
      "動画を削除",
      "本当にこの動画をプレイリストから削除しますか？",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "削除",
          style: "destructive",
          onPress: async () => {
            const payload: RemoveVideoPayload = {
              playlistId: playlist.playlistId,
              videoId: videoId,
            };
            try {
              await ApiService.removeVideoFromPlaylist(payload);
              Alert.alert("成功", "動画が削除されました。");
              navigation.goBack(); // HomeScreen で再取得されることを期待
            } catch (error: any) {
              console.error("動画の削除に失敗:", error);
              Alert.alert("エラー", `動画の削除に失敗しました: ${error.message}`);
            }
          },
        },
      ]
    );
  };

  if (!playlist || !playlist.videos || playlist.videos.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.playlistTitle}>{playlist.name || `プレイリスト ${playlist.playlistId}`}</Text>
        <Text style={styles.emptyText}>このプレイリストには動画がありません。</Text>
      </View>
    );
  }
  console.log("Videos data for FlatList:", JSON.stringify(playlist.videos, null, 2)); // FlatListの直前に追加
  return (
    <View style={styles.container}>
      <Text style={styles.playlistTitle}>{playlist.name || `プレイリスト ${playlist.playlistId}`}</Text>
      <FlatList<Video>
        data={playlist.videos}
        keyExtractor={(item, index) => {
          if (item && typeof item.videoId === 'string' && item.videoId.length > 0) {
            return item.videoId;
          }
          // Log an error or warning if videoId is missing or invalid
          console.warn(`Missing or invalid videoId for item at index ${index} in playlist ${playlist?.playlistId}. Using index as fallback key.`);
          return `video-fallback-${playlist?.playlistId}-${index}`; // Fallback key
        }}
        renderItem={({ item }) => (
          <View style={styles.videoItemContainer}>
            <TouchableOpacity onPress={() => openVideo(item.url)} style={styles.videoInfo}>
              <Text style={styles.videoTitle}>{item.title || item.url}</Text>
            </TouchableOpacity>
            <Button title="削除" color="red" onPress={() => handleDeleteVideo(item.videoId)} />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10 },
  playlistTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  emptyText: { textAlign: 'center', marginTop: 20, fontSize: 16, color: 'gray' },
  videoItemContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    padding: 15,
    marginVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  videoInfo: { flex: 1 },
  videoTitle: { fontSize: 16 },
});
