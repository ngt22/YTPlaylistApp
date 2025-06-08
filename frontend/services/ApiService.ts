import axios, { AxiosError } from 'axios';
import { Playlist, Video } from '../types'; // 型定義をインポート

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.response.use(
  response => response,
  (error: AxiosError) => {
    if (error.response) {
      console.error('API Error Response:', error.response.data);
      console.error('Status:', error.response.status);
    } else if (error.request) {
      console.error('API No Response:', error.request);
    } else {
      console.error('API Error Message:', error.message);
    }
    return Promise.reject(error.response?.data || new Error('APIリクエストに失敗しました。'));
  }
);

// APIペイロードの型定義
export interface AddVideoPayload {
  playlistName: string;
  videoUrl: string;
  videoTitle?: string;
}

export interface AddVideoResponse { // Lambdaからのレスポンス型 (例)
  message: string;
  playlistId: string;
  video: Video;
}

export interface RemoveVideoPayload {
  playlistId: string;
  videoId: string;
}

// For updating video title
export interface UpdateVideoTitlePayload {
  playlistId: string;
  videoId: string;
  newTitle: string;
}

export interface UpdateVideoTitleResponse {
  message: string;
  video: Video;
}

// For updating playlist name
export interface UpdatePlaylistNamePayload {
  playlistId: string;
  newName: string;
}

export interface UpdatePlaylistNameResponse {
  message: string;
  playlist: Playlist;
}

// For deleting a playlist
export interface DeletePlaylistResponse {
  message: string;
}

const ApiService = {
  getPlaylists: async (userId: string = 'defaultUser'): Promise<Playlist[]> => {
    try {
      const response = await apiClient.get<Playlist[]>(`/playlists`); // Lambda側でuserIdを考慮
      return response.data;
    } catch (error) {
      console.error('getPlaylists error:', error);
      throw error;
    }
  },

  addVideoToPlaylist: async (data: AddVideoPayload): Promise<AddVideoResponse> => {
    try {
      const response = await apiClient.post<AddVideoResponse>('/videos', data);
      return response.data;
    } catch (error) {
      console.error('addVideoToPlaylist error:', error);
      throw error;
    }
  },

  removeVideoFromPlaylist: async (data: RemoveVideoPayload): Promise<{ message: string }> => {
    try {
      const response = await apiClient.delete<{ message: string }>(`/playlists/${data.playlistId}/videos/${data.videoId}`);
      return response.data;
    } catch (error) {
      console.error('removeVideoFromPlaylist error:', error);
      throw error;
    }
  },

  updateVideoTitle: async (payload: UpdateVideoTitlePayload): Promise<UpdateVideoTitleResponse> => {
    try {
      const response = await apiClient.put<UpdateVideoTitleResponse>(
        `/playlists/${payload.playlistId}/videos/${payload.videoId}/title`,
        { newTitle: payload.newTitle } // Only send newTitle in the body
      );
      return response.data;
    } catch (error) {
      console.error('updateVideoTitle error:', error);
      throw error;
    }
  },

  updatePlaylistName: async (payload: UpdatePlaylistNamePayload): Promise<UpdatePlaylistNameResponse> => {
    try {
      const response = await apiClient.put<UpdatePlaylistNameResponse>(
        `/playlists/${payload.playlistId}/name`,
        { newName: payload.newName }
      );
      return response.data;
    } catch (error) {
      console.error('updatePlaylistName error:', error);
      throw error;
    }
  },

  deletePlaylist: async (playlistId: string): Promise<DeletePlaylistResponse> => {
    try {
      const response = await apiClient.delete<DeletePlaylistResponse>(
        `/playlists/${playlistId}`
      );
      return response.data;
    } catch (error) {
      console.error('deletePlaylist error:', error);
      throw error;
    }
  },
};

export default ApiService;