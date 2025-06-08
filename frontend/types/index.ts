// types/index.ts
export interface Video {
  videoId: string;
  url: string;
  title?: string;
  thumbnailUrl?: string;
  addedAt: string;
}

export interface Playlist {
  playlistId: string;
  name: string;
  videos: Video[];
  createdAt: string;
  updatedAt?: string;
  userId?: string; // 認証導入後
}

// React Navigation の型定義 (例)
export type RootStackParamList = {
  Home: undefined;
  AddVideo: { playlistId?: string; playlistName?: string }; // Modified
  PlaylistDetail: { playlist: Playlist };
  // TODO: Add other routes here as the app grows, e.g., Auth/Login, Settings
};

// Payload for adding a video to a playlist
export interface AddVideoPayload {
  playlistId: string; // Changed from playlistName
  videoUrl: string;
  videoTitle?: string;
}

// Payload for creating a new playlist
export interface CreatePlaylistPayload {
  name: string;
}
