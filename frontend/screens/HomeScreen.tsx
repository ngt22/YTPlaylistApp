import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, Button, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert } from 'react-native';
import ApiService from '../services/ApiService';
import { useFocusEffect, NavigationProp, RouteProp } from '@react-navigation/native'; // Added RouteProp
import { Playlist, RootStackParamList } from '../types'; // 型定義をインポート
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'; // For edit icon

type HomeScreenNavigationProp = NavigationProp<RootStackParamList, 'Home'>;
// Define the route prop type for HomeScreen to access sharedUrl
type HomeScreenRouteProp = RouteProp<RootStackParamList, 'Home'>;

interface Props {
  navigation: HomeScreenNavigationProp;
  route: HomeScreenRouteProp; // Added route to props
}

export default function HomeScreen({ navigation, route }: Props): JSX.Element {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditPlaylistModalVisible, setIsEditPlaylistModalVisible] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const [isCreatePlaylistModalVisible, setIsCreatePlaylistModalVisible] = useState(false);
  const [newPlaylistInputName, setNewPlaylistInputName] = useState('');

  // State for handling shared URL
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);
  const [sharedVideoUrl, setSharedVideoUrl] = useState<string | null>(null);
  const [selectedPlaylistForShare, setSelectedPlaylistForShare] = useState<Playlist | null>(null);
  // Re-using newPlaylistInputName for creating playlist in share flow, or create a dedicated one e.g. newPlaylistNameForShare
  // For simplicity, we might reuse newPlaylistInputName and manage its context (e.g. clear it appropriately)
  // Or, let's define a new one for clarity if the "Create Playlist" FAB modal and "Share" modal can be open independently or have distinct flows.
  // Given the FAB opens one modal, and share opens another, separate state is cleaner.
  const [newPlaylistNameForShare, setNewPlaylistNameForShare] = useState('');


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

      // Check for sharedUrl param when screen comes into focus
      if (route.params?.sharedUrl) {
        const urlToShare = route.params.sharedUrl;
        console.log("HomeScreen received sharedUrl:", urlToShare);
        setSharedVideoUrl(urlToShare);
        setIsShareModalVisible(true);
        setSelectedPlaylistForShare(null); // Reset selection
        setNewPlaylistNameForShare(''); // Reset new playlist input for share modal
        // Clear the param so it doesn't re-trigger on next focus without a new share action
        navigation.setParams({ sharedUrl: undefined });
      }
    }, [route.params?.sharedUrl]) // Dependency on sharedUrl from route.params
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

  const handleCreatePlaylist = async () => {
    const trimmedName = newPlaylistInputName.trim();
    if (!trimmedName) {
      Alert.alert("エラー", "プレイリスト名を入力してください。");
      return;
    }

    try {
      // Assuming ApiService.createPlaylist exists and handles the API call
      // For example: await ApiService.createPlaylist({ name: trimmedName });
      // Simulating API call for now
      await ApiService.createPlaylist({ name: trimmedName }); // Replace with actual call if available

      Alert.alert("成功", `プレイリスト「${trimmedName}」が作成されました。`);
      fetchPlaylists(); // Refresh playlists
      setIsCreatePlaylistModalVisible(false);
      setNewPlaylistInputName('');
    } catch (error: any) {
      console.error("プレイリストの作成に失敗:", error);
      Alert.alert("エラー", `プレイリストの作成に失敗しました: ${error.message || '不明なエラー'}`);
      // Optionally, do not close modal on error, or handle specific errors
    }
  };

  const handleAddSharedVideoToPlaylist = (playlistId: string) => {
    if (!sharedVideoUrl) {
      Alert.alert("エラー", "共有された動画のURLが見つかりません。");
      return;
    }
    navigation.navigate('AddVideo', { playlistId: playlistId, videoUrl: sharedVideoUrl });
    setIsShareModalVisible(false);
    setSharedVideoUrl(null);
  };

  const handleCreatePlaylistAndAddSharedVideo = async () => {
    const trimmedName = newPlaylistNameForShare.trim();
    if (!trimmedName) {
      Alert.alert("エラー", "プレイリスト名を入力してください。");
      return;
    }
    if (!sharedVideoUrl) {
      Alert.alert("エラー", "共有された動画のURLが見つかりません。");
      setIsShareModalVisible(false); // Close share modal as well
      return;
    }

    try {
      const newPlaylist = await ApiService.createPlaylist({ name: trimmedName });
      Alert.alert("成功", `新しいプレイリスト「${trimmedName}」が作成されました。`);
      fetchPlaylists(); // Refresh playlists
      setNewPlaylistNameForShare(''); // Clear input

      // Now add the video to this new playlist
      handleAddSharedVideoToPlaylist(newPlaylist.playlistId);
      // The share modal is already closed by handleAddSharedVideoToPlaylist
    } catch (error: any) {
      console.error("共有のためのプレイリスト作成に失敗:", error);
      Alert.alert("エラー", `プレイリストの作成に失敗しました: ${error.message || '不明なエラー'}`);
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
      {/* <Button
        title="新しい動画を追加"
        onPress={() => navigation.navigate('AddVideo')}
      /> */}
      {/* Edit Playlist Modal */}
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

      {/* Create New Playlist Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isCreatePlaylistModalVisible}
        onRequestClose={() => {
          setIsCreatePlaylistModalVisible(false);
          setNewPlaylistInputName('');
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>新しいプレイリストを作成</Text>
            <TextInput
              style={styles.modalInput}
              value={newPlaylistInputName}
              onChangeText={setNewPlaylistInputName}
              placeholder="プレイリスト名"
            />
            <View style={styles.modalButtonContainer}>
              <Button title="キャンセル" onPress={() => {
                setIsCreatePlaylistModalVisible(false);
                setNewPlaylistInputName('');
              }} color="gray" />
              <Button title="作成" onPress={handleCreatePlaylist} />
            </View>
          </View>
        </View>
      </Modal>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setIsCreatePlaylistModalVisible(true)}
      >
        <MaterialIcons name="add" size={30} color="#fff" />
      </TouchableOpacity>

      {/* Modal for adding shared video to a playlist */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isShareModalVisible}
        onRequestClose={() => {
          setIsShareModalVisible(false);
          setSharedVideoUrl(null); // Clear the URL when closing
          setSelectedPlaylistForShare(null);
          setNewPlaylistNameForShare('');
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>共有動画をプレイリストに追加</Text>
            {sharedVideoUrl && <Text style={styles.shareUrlText}>動画URL: {sharedVideoUrl}</Text>}

            <Text style={styles.modalSectionTitle}>既存のプレイリストに追加:</Text>
            {playlists.length > 0 ? (
              <FlatList
                data={playlists}
                keyExtractor={(item) => item.playlistId}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.playlistSelectItem,
                      selectedPlaylistForShare?.playlistId === item.playlistId && styles.playlistSelectedItem
                    ]}
                    onPress={() => setSelectedPlaylistForShare(item)}
                  >
                    <Text style={styles.playlistSelectItemText}>{item.name}</Text>
                  </TouchableOpacity>
                )}
                style={styles.playlistSelectionList}
              />
            ) : (
              <Text style={styles.emptyShareText}>利用可能なプレイリストがありません。以下から作成してください。</Text>
            )}
            <Button
              title="選択したプレイリストに追加"
              onPress={() => selectedPlaylistForShare && handleAddSharedVideoToPlaylist(selectedPlaylistForShare.playlistId)}
              disabled={!selectedPlaylistForShare || !sharedVideoUrl}
            />

            <Text style={styles.modalSectionTitle}>または、新しいプレイリストを作成して追加:</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="新しいプレイリスト名"
              value={newPlaylistNameForShare}
              onChangeText={setNewPlaylistNameForShare}
            />
            <Button
              title="作成して追加"
              onPress={handleCreatePlaylistAndAddSharedVideo}
              disabled={!newPlaylistNameForShare.trim() || !sharedVideoUrl}
            />
            <View style={styles.modalButtonContainer}>
              <Button title="キャンセル" onPress={() => {
                setIsShareModalVisible(false);
                setSharedVideoUrl(null);
                setSelectedPlaylistForShare(null);
                setNewPlaylistNameForShare('');
               }} color="gray" />
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
  emptyShareText: { textAlign: 'center', marginVertical: 10, fontSize: 14, color: 'gray' },
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
    marginBottom: 15, // Adjusted
    borderRadius: 8,
    fontSize: 16,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    width: '100%',
    marginTop: 20, // Added margin
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
  shareUrlText: {
    fontSize: 14,
    color: 'gray',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 10,
  },
  playlistSelectionList: {
    maxHeight: 150, //  Limit height for scrollability
    marginBottom: 15,
  },
  playlistSelectItem: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  playlistSelectedItem: {
    backgroundColor: '#e0e0e0', // Highlight selected item
  },
  playlistSelectItemText: {
    fontSize: 16,
  }
});
