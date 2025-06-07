import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from '../screens/HomeScreen';
import AddVideoScreen from '../screens/AddVideoScreen';
import PlaylistDetailScreen from '../screens/PlaylistDetailScreen';
import { RootStackParamList } from '../types'; // 型定義をインポート

const Stack = createStackNavigator<RootStackParamList>();

export default function AppNavigator(): JSX.Element {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'マイプレイリスト' }} />
        <Stack.Screen name="AddVideo" component={AddVideoScreen} options={{ title: '動画を追加' }} />
        <Stack.Screen name="PlaylistDetail" component={PlaylistDetailScreen} options={{ title: 'プレイリスト詳細' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}