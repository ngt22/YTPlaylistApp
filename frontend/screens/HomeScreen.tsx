import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, Button, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert } from 'react-native';
import ApiService from '../services/ApiService';
import { useFocusEffect, NavigationProp } from '@react-navigation/native';
import { Playlist, RootStackParamList } from '../types'; // 型定義をインポート
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'; // For edit icon

type HomeScreenNavigationProp = NavigationProp<RootStackParamList, 'Home'>;

interface Props {
  navigation: HomeScreenNavigationProp;
}

export default function HomeScreen({ navigation }: Props): JSX.Element {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditPlaylistModalVisible, setIsEditPlaylistModalVisible] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');

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

  const confirmDeletePlaylist = (playlistId: string, playlistName: string) => {
    Alert.alert(
      "プレイリストを削除",
      `「${playlistName}」を本当に削除しますか？この操作は元に戻せません。`,
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "削除",
          style: "destructive",
          onPress: () => handleDeletePlaylist(playlistId),
        },
      ]
    );
  };

  const handleDeletePlaylist = async (playlistId: string) => {
    try {
      await ApiService.deletePlaylist(playlistId);
      setPlaylists(prevPlaylists =>
        prevPlaylists.filter(p => p.playlistId !== playlistId)
      );
      Alert.alert("成功", "プレイリストが削除されました。");
    } catch (error: any) {
      Alert.alert("エラー", `プレイリストの削除に失敗しました: ${error.message}`);
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

  const handleOpenEditPlaylistModal = (playlist: Playlist) => {
    setEditingPlaylist(playlist);
    setNewPlaylistName(playlist.name || '');
    setIsEditPlaylistModalVisible(true);
  };

  const handleCloseEditPlaylistModal = () => {
    setIsEditPlaylistModalVisible(false);
    setEditingPlaylist(null);
    setNewPlaylistName('');
  };

  const handleSavePlaylistName = async () => {
    if (!editingPlaylist || !newPlaylistName.trim()) {
      Alert.alert("エラー", "プレイリスト名を入力してください。");
      return;
    }

    try {
      const response = await ApiService.updatePlaylistName({
        playlistId: editingPlaylist.playlistId,
        newName: newPlaylistName.trim(),
      });

      setPlaylists(prevPlaylists =>
        prevPlaylists.map(p =>
          p.playlistId === response.playlist.playlistId ? response.playlist : p
        )
      );
      Alert.alert("成功", "プレイリスト名が更新されました。");
      handleCloseEditPlaylistModal();
    } catch (error: any) {
      Alert.alert("エラー", `プレイリスト名の更新に失敗しました: ${error.message}`);
    }
  };

  return (
    <View style={styles.container}>
      {playlists.length === 0 && !loading && (
        <Text style={styles.emptyText}>プレイリストがありません。新しい動画を追加してプレイリストを作成しましょう！</Text>
      )}
      <FlatList<Playlist>
        data={playlists}
        keyExtractor={(item) => item.playlistId || Math.random().toString()}
        renderItem={({ item }) => (
          <View style={styles.playlistItemContainer}>
            <TouchableOpacity
              style={styles.playlistInfoContainer}
              onPress={() => navigation.navigate('PlaylistDetail', { playlist: item })}
            >
              <Text style={styles.playlistName}>{item.name || `プレイリスト ${item.playlistId}`}</Text>
              <Text style={styles.videoCount}>{item.videos ? item.videos.length : 0} 本の動画</Text>
            </TouchableOpacity>
            <View style={styles.actionsContainer}>
              <TouchableOpacity onPress={() => handleOpenEditPlaylistModal(item)} style={styles.iconButton}>
                <MaterialIcons name="edit" size={22} color="#007AFF" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmDeletePlaylist(item.playlistId, item.name)} style={styles.iconButton}>
                <MaterialIcons name="delete" size={22} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
      <Button
        title="新しい動画を追加"
        onPress={() => navigation.navigate('AddVideo')}
      />
      <Modal
        animationType="slide"
        transparent={true}
        visible={isEditPlaylistModalVisible}
        onRequestClose={handleCloseEditPlaylistModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>プレイリスト名を編集</Text>
            <TextInput
              style={styles.modalInput}
              value={newPlaylistName}
              onChangeText={setNewPlaylistName}
              placeholder="新しいプレイリスト名"
            />
            <View style={styles.modalButtonContainer}>
              <Button title="キャンセル" onPress={handleCloseEditPlaylistModal} color="gray" />
              <Button title="保存" onPress={handleSavePlaylistName} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: 'red', marginBottom: 10 },
  emptyText: { textAlign: 'center', marginTop: 20, fontSize: 16, color: 'gray' },
  playlistItemContainer: {
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
  playlistInfoContainer: {
    flex: 1,
    marginRight: 8, // Add some space before the action icons
  },
  playlistName: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  videoCount: { fontSize: 14, color: 'gray', marginTop: 5 },
  actionsContainer: {
    flexDirection: 'row',
  },
  iconButton: {
    padding: 8,
    marginLeft: 8, // Space between icons if there are multiple
  },
  // Modal Styles (can be shared or defined locally)
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
    alignItems: 'stretch',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingVertical: 12,
    paddingHorizontal: 15,
    marginBottom: 25,
    borderRadius: 8,
    fontSize: 16,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    width: '100%',
  },
});
