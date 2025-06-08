import React, { useEffect, useState, useRef } from 'react';
import AppNavigator from './navigation/AppNavigator';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { Alert } from 'react-native';
import { NavigationContainerRef } from '@react-navigation/native'; // For navigationRef

// Navigation reference to allow navigation from outside components
export const navigationRef = React.createRef<NavigationContainerRef<any>>();

function parseAndHandleUrl(url: string, from: 'initial' | 'listener') {
  console.log(`App received URL via ${from}:`, url);
  const { hostname, path, queryParams } = Linking.parse(url);

  // Check if it's a YouTube URL
  if ((hostname.includes('youtube.com') && path?.includes('watch')) || hostname.includes('youtu.be')) {
    // The full URL (url variable) is the YouTube video URL
    Alert.alert("YouTube URL Detected", `URL: ${url}\nHost: ${hostname}\nPath: ${path}\nQuery: ${JSON.stringify(queryParams)}`);

    // Navigate to HomeScreen with sharedUrl param
    // Ensure navigator is ready before attempting to navigate
    if (navigationRef.isReady()) {
      navigationRef.navigate('Home', { sharedUrl: url });
    } else {
      // You might want to queue the navigation action until the navigator is ready
      // For this example, we'll log an error or alert
      console.warn("Navigator not ready, cannot navigate to handle shared URL yet.");
      Alert.alert("Share Error", "Could not open shared link, app navigator not ready.");
    }
  } else {
    console.log("Non-YouTube URL received:", url);
    // Optionally handle other types of URLs or schemes (e.g., myplaylistapp://)
  }
}
export default function App(): JSX.Element {
  const currentUrl = Linking.useURL();
  const [initialUrlProcessed, setInitialUrlProcessed] = useState(false);

  useEffect(() => {
    // Handle initial URL
    if (currentUrl && !initialUrlProcessed) {
      parseAndHandleUrl(currentUrl, 'initial');
      setInitialUrlProcessed(true);
    }
  }, [currentUrl, initialUrlProcessed]);

  useEffect(() => {
    // Listen for new URLs received while the app is open
    const subscription = Linking.addLinkingListener(event => {
      parseAndHandleUrl(event.url, 'listener');
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      {/* Pass the navigationRef to AppNavigator if it's a NavigationContainer */}
      {/* If AppNavigator is just a stack, it should be wrapped in NavigationContainer here */}
      {/* Assuming AppNavigator is the NavigationContainer or contains it and can accept a ref */}
      <AppNavigator ref={navigationRef} />
    </SafeAreaProvider>
  );
}
