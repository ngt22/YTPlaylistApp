// types/index.ts
export interface Video {
  videoId: string;
  url: string;
  title?: string;
  thumbnail?: string;
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
  AddVideo: undefined;
  PlaylistDetail: { playlist: Playlist };
};
