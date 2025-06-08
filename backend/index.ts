// Lambda function handler (index.js)
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'; // Using V2 type for APIGatewayProxyEventV2 (recommended)
const getYoutubeThumbnail = require('youtube-thumbnail-grabber');
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
  QueryCommand // Ensure this is present
} = require("@aws-sdk/lib-dynamodb");
const { randomUUID } = require('crypto'); // videoId生成用

// Initialize DynamoDB DocumentClient
const client = new DynamoDBClient({ region: process.env.AWS_REGION_DEFAULT || "ap-southeast-2" });
const docClient = DynamoDBDocumentClient.from(client);

const PLAYLISTS_TABLE_NAME = process.env.PLAYLISTS_TABLE_NAME || 'YouTubePlaylistsTS'; // Get from environment variable

// Helper function: Generate API response
const createResponse = (statusCode, body) => {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "YOUR_FRONTEND_URL_HERE_OR_LOCALHOST_FOR_DEV", // CORS settings: Use FRONTEND_URL env var or a placeholder
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token"
    },
    body: JSON.stringify(body),
  };
};

// Helper function to extract YouTube Video ID from various URL formats.
function extractYouTubeVideoId(url: string): string | null {
  if (!url) {
    return null;
  }
  // Regular expression to cover various YouTube URL formats
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/|live\/|playlist\?list=.*&v=)([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})(?:\?.*)?/,
    /(?:https?:\/\/)?(?:www\.)?m\.youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/|live\/)([a-zA-Z0-9_-]{11})/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      // Ensure the matched ID is a valid YouTube ID length
      if (match[1].length === 11) {
        return match[1];
      }
    }
  }
  // Fallback for URLs that might have the video ID as a query parameter 'v' but not caught by other regexes
  try {
    const parsedUrl = new URL(url);
    const videoId = parsedUrl.searchParams.get('v');
    if (videoId && videoId.length === 11 && /^[a-zA-Z0-9_-]+$/.test(videoId)) {
      return videoId;
    }
  } catch (e) {
    // Invalid URL, ignore
  }

  return null; // Return null if no match
}


exports.handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2>=> {
 console.log("Received event:", JSON.stringify(event, null, 2));
  const httpMethod = event.requestContext.http.method; // Adjusted for V2 event structure
  const path = event.requestContext.http.path;       // Adjusted for V2 event structure (または event.rawPath でも可)
  const body = event.body ? JSON.parse(event.body) : {};
  // const userId = event.requestContext?.authorizer?.claims?.sub || 'defaultUser'; // Cognito認証などを使用する場合

  try {
    // OPTIONS method is for CORS preflight requests
    if (httpMethod === "OPTIONS") {
      return createResponse(200, { message: "CORS preflight" });
    }

    // Routing
    if (path === "/playlists" && httpMethod === "GET") {
      // Get all playlists (in a real scenario, filter by userId)
      const command = new ScanCommand({ TableName: PLAYLISTS_TABLE_NAME });
      const { Items } = await docClient.send(command);
      return createResponse(200, Items || []);
    } else if (path === "/videos" && httpMethod === "POST") {
      // Add video to playlist or create new playlist
      const { playlistName, videoUrl, videoTitle } = body;
      if (!playlistName || !videoUrl) {
        return createResponse(400, { error: "playlistName and videoUrl are required" });
      }

      const extractedVideoId = extractYouTubeVideoId(videoUrl);
      if (!extractedVideoId) {
          return createResponse(400, { error: "Invalid YouTube URL or unable to extract video ID." });
      }

      let videoThumbnailUrl = null; // Initialize videoThumbnailUrl
      try {
          const thumbnailData = await getYoutubeThumbnail(extractedVideoId);
          if (thumbnailData) {
              if (thumbnailData.high && thumbnailData.high.url) {
                  videoThumbnailUrl = thumbnailData.high.url;
              } else if (thumbnailData.medium && thumbnailData.medium.url) {
                  videoThumbnailUrl = thumbnailData.medium.url;
              } else if (thumbnailData.default && thumbnailData.default.url) {
                  videoThumbnailUrl = thumbnailData.default.url;
              } else {
                  console.warn(`No suitable thumbnail resolution found for video ID ${extractedVideoId}. Thumbnail data: ${JSON.stringify(thumbnailData)}`);
              }
          } else {
              console.warn(`No thumbnail data returned for video ID ${extractedVideoId}.`);
          }
      } catch (thumbError) {
          console.error(`Error fetching thumbnail for video ID ${extractedVideoId}:`, thumbError);
          // videoThumbnailUrl remains null, allowing video to be saved without a thumbnail
      }

      const newVideo = {
        videoId: randomUUID(), // Unique ID for each video
        url: videoUrl,
        title: videoTitle || `動画 - ${extractedVideoId}`, // If title is not provided, use part of the URL or a default
        addedAt: new Date().toISOString(),
        thumbnailUrl: videoThumbnailUrl, // Use the safely extracted or null URL
      };

      // Search for existing playlist by playlistName using a QueryCommand.
      // This requires a Global Secondary Index (GSI) on the 'name' attribute of the PLAYLISTS_TABLE_NAME table.
      // If a GSI named 'PlaylistNameIndex' (or similar) exists with 'name' as its hash key:
      const queryCommand = new QueryCommand({
        TableName: PLAYLISTS_TABLE_NAME,
        IndexName: "PlaylistNameIndex", // IMPORTANT: This is an assumed GSI name. Adjust if different.
        KeyConditionExpression: "#nm = :name",
        ExpressionAttributeNames: { "#nm": "name" },
        ExpressionAttributeValues: { ":name": playlistName },
      });
      const { Items: existingPlaylists } = await docClient.send(queryCommand);

      let playlistId;
      if (existingPlaylists && existingPlaylists.length > 0) {
        // Add to existing playlist
        playlistId = existingPlaylists[0].playlistId;
        const updateCommand = new UpdateCommand({
          TableName: PLAYLISTS_TABLE_NAME,
          Key: { playlistId: playlistId },
          UpdateExpression: "SET videos = list_append(if_not_exists(videos, :empty_list), :new_video)",
          ExpressionAttributeValues: {
            ":new_video": [newVideo],
            ":empty_list": [],
          },
          ReturnValues: "UPDATED_NEW",
        });
        await docClient.send(updateCommand);
        return createResponse(200, { message: "Video added to existing playlist", playlistId, video: newVideo });
      } else {
        // Create new playlist
        playlistId = randomUUID(); // New playlist ID
        const putCommand = new PutCommand({
          TableName: PLAYLISTS_TABLE_NAME,
          Item: {
            playlistId: playlistId,
            name: playlistName,
            videos: [newVideo],
            createdAt: new Date().toISOString(),
            // userId: userId, // Add after authentication is implemented
          },
        });
        await docClient.send(putCommand);
        return createResponse(201, { message: "New playlist created and video added", playlistId, video: newVideo });
      }
    } else if (path.startsWith("/playlists/") && httpMethod === "DELETE") {
        // Example path: /playlists/{playlistId}/videos/{videoId}
        const parts = path.split('/');
        if (parts.length === 5 && parts[3] === 'videos') {
            const playlistId = parts[2];
            const videoIdToDelete = parts[4];

            // First, get the playlist
            const getCmd = new GetCommand({
                TableName: PLAYLISTS_TABLE_NAME,
                Key: { playlistId: playlistId }
            });
            const { Item: playlist } = await docClient.send(getCmd);

            if (!playlist || !playlist.videos) {
                return createResponse(404, { error: "Playlist or videos not found" });
            }

            // Create a new list of videos, excluding the one with videoIdToDelete
            const updatedVideos = playlist.videos.filter(video => video.videoId !== videoIdToDelete);

            if (updatedVideos.length === playlist.videos.length) {
                 return createResponse(404, { error: "Video ID not found in playlist" });
            }

            // Update the videos list
            const updateCmd = new UpdateCommand({
                TableName: PLAYLISTS_TABLE_NAME,
                Key: { playlistId: playlistId },
                UpdateExpression: "SET videos = :videos",
                ExpressionAttributeValues: {
                    ":videos": updatedVideos
                },
                ReturnValues: "UPDATED_NEW"
            });
            await docClient.send(updateCmd);
            return createResponse(200, { message: "Video deleted successfully" });
        }
    }
    // TODO: Implement other CRUD operations (update/delete playlists, etc.)

    return createResponse(404, { error: "Not Found" });

  } catch (error) {
    console.error("Error processing request:", error);
    return createResponse(500, { error: "Internal Server Error", details: error.message });
  }
};
