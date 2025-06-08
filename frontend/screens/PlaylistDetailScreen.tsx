import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, Linking, Alert, TouchableOpacity, Image, Modal, TextInput, Button } from 'react-native'; // Added Modal, TextInput, Button
import Icon from 'react-native-vector-icons/FontAwesome';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'; // For edit icon
import * as WebBrowser from 'expo-web-browser';
import ApiService, { RemoveVideoPayload, UpdateVideoTitleResponse } from '../services/ApiService';
import { RouteProp, NavigationProp } from '@react-navigation/native';
import { RootStackParamList, Playlist, Video } from '../types';

type PlaylistDetailScreenRouteProp = RouteProp<RootStackParamList, 'PlaylistDetail'>;
type PlaylistDetailScreenNavigationProp = NavigationProp<RootStackParamList, 'PlaylistDetail'>;

interface Props {
  route: PlaylistDetailScreenRouteProp;
  navigation: PlaylistDetailScreenNavigationProp;
}

export default function PlaylistDetailScreen({ route, navigation }: Props): JSX.Element {
  const initialPlaylist = route.params.playlist;
  const [videos, setVideos] = useState<Video[]>(initialPlaylist.videos || []);
  const [playlistName, setPlaylistName] = useState<string>(initialPlaylist.name || ''); // Keep playlist name in state if needed

  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [newVideoTitle, setNewVideoTitle] = useState('');

  // Update local videos if route params change (e.g., after adding a video and coming back)
  // This might be too simplistic if deep object comparison is needed or if playlistId changes.
  useEffect(() => {
    if (route.params.playlist && route.params.playlist.videos) {
      setVideos(route.params.playlist.videos);
      setPlaylistName(route.params.playlist.name || '');
    }
  }, [route.params.playlist]);


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
              playlistId: initialPlaylist.playlistId, // Use initialPlaylist for non-mutable data like ID
              videoId: videoId,
            };
            try {
              await ApiService.removeVideoFromPlaylist(payload);
              // Update local state after deletion
              setVideos(currentVideos => currentVideos.filter(v => v.videoId !== videoId));
              Alert.alert("成功", "動画が削除されました。");
              // navigation.goBack(); // Consider if going back is always desired or if the screen should reflect empty state
            } catch (error: any) {
              console.error("動画の削除に失敗:", error); // Log the full error
              Alert.alert("エラー", `動画の削除に失敗しました: ${error.message}`);
            }
          },
        },
      ]
    );
  };

  const handleOpenEditModal = (video: Video) => {
    setEditingVideo(video);
    setNewVideoTitle(video.title || '');
    setIsEditModalVisible(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalVisible(false);
    setEditingVideo(null);
    setNewVideoTitle('');
  };

  const handleSaveChanges = async () => {
    if (!editingVideo || !newVideoTitle.trim()) {
      Alert.alert("エラー", "タイトルを入力してください。");
      return;
    }
    if (!initialPlaylist?.playlistId) {
       Alert.alert("エラー", "プレイリスト情報が見つかりません。");
       return;
    }

    try {
      const updatedVideoData: UpdateVideoTitleResponse = await ApiService.updateVideoTitle({
        playlistId: initialPlaylist.playlistId,
        videoId: editingVideo.videoId,
        newTitle: newVideoTitle.trim(),
      });

      const updatedVideos = videos.map(v =>
          v.videoId === updatedVideoData.video.videoId ? updatedVideoData.video : v
      );
      setVideos(updatedVideos);

      Alert.alert("成功", "動画のタイトルが更新されました。");
      handleCloseEditModal();
    } catch (error: any) {
      Alert.alert("エラー", `タイトルの更新に失敗しました: ${error.message}`);
    }
  };


  if (!initialPlaylist) { // Simplified check, as videos.length === 0 is handled below or by FlatList's ListEmptyComponent
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>プレイリスト情報が見つかりません。</Text>
      </View>
    );
  }


  return (
    <View style={styles.container}>
      <Text style={styles.playlistTitle}>{playlistName || `プレイリスト ${initialPlaylist?.playlistId}`}</Text>
      <FlatList<Video>
        data={videos} // Use local state for videos
        keyExtractor={(item) => item.videoId || Math.random().toString()} // Ensure key is always string
        ListEmptyComponent={<Text style={styles.emptyText}>このプレイリストには動画がありません。</Text>}
        renderItem={({ item }) => (
          <View style={styles.videoItemContainer}>
            {item.thumbnailUrl && <Image source={{ uri: item.thumbnailUrl }} style={styles.thumbnail} />}
            <TouchableOpacity onPress={() => openVideo(item.url)} style={styles.videoInfo}>
              <Text style={styles.videoTitle} numberOfLines={2} ellipsizeMode="tail">{item.title || item.url}</Text>
            </TouchableOpacity>
            <View style={styles.actionsContainer}>
              <TouchableOpacity onPress={() => handleOpenEditModal(item)} style={styles.iconButton}>
                <MaterialIcons name="edit" size={22} color="#007AFF" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDeleteVideo(item.videoId)} style={styles.iconButton}>
                <Icon name="trash" size={24} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
      <Modal
        animationType="slide"
        transparent={true}
        visible={isEditModalVisible}
        onRequestClose={handleCloseEditModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>動画のタイトルを編集</Text>
            <TextInput
              style={styles.modalInput}
              value={newVideoTitle}
              onChangeText={setNewVideoTitle}
              placeholder="新しい動画のタイトル"
            />
            <View style={styles.modalButtonContainer}>
              <Button title="キャンセル" onPress={handleCloseEditModal} color="gray" />
              <Button title="保存" onPress={handleSaveChanges} />
            </View>
          </View>
        </View>
      </Modal>
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddVideo', { playlistId: initialPlaylist.playlistId, playlistName: playlistName })}
      >
        <MaterialIcons name="add" size={30} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { fontSize: 16, color: 'red', textAlign: 'center' },
  playlistTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#333' },
  emptyText: { textAlign: 'center', marginTop: 50, fontSize: 18, color: 'gray' },
  videoItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    marginVertical: 8,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.20,
    shadowRadius: 1.41,
    elevation: 2,
  },
  thumbnail: {
    width: 90, // Slightly smaller
    height: 50, // Adjust height for 16:9
    borderRadius: 4,
    marginRight: 12,
  },
  videoInfo: {
    flex: 1,
    justifyContent: 'center',
    marginRight: 8, // Space before action icons
  },
  videoTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 8,
    marginLeft: 8, // Space between icons
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 25,
    alignItems: 'stretch', // Stretch children like input
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '90%', // Wider modal
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    width: '100%', // Take full width of modalView padding
    borderWidth: 1,
    borderColor: '#E0E0E0', // Lighter border
    paddingVertical: 12,
    paddingHorizontal: 15,
    marginBottom: 25,
    borderRadius: 8,
    fontSize: 16,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly', // Evenly space buttons
    width: '100%',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 20,
    bottom: 20,
    backgroundColor: '#007AFF', // iOS blue
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8, // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
