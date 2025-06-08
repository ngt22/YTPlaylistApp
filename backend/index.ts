// Lambda function handler (index.js)
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'; // Using V2 type for APIGatewayProxyEventV2 (recommended)
// const getYoutubeThumbnail = require('youtube-thumbnail-grabber'); // Removed
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


exports.handler = async (event) => {
    console.log("Received event:", JSON.stringify(event, null, 2));
    const httpMethod = event.requestContext.http.method;
    const path = event.requestContext.http.path;
    const body = event.body ? JSON.parse(event.body) : {};

    try {
        if (httpMethod === "OPTIONS") {
            return createResponse(200, { message: "CORS preflight" });
        }

        // --- ルーティングロジックの順番を修正 ---
        // より具体的なパスを先に評価するように変更

        if (path === "/playlists" && httpMethod === "GET") {
            // ... (変更なし) ...
            const command = new ScanCommand({ TableName: PLAYLISTS_TABLE_NAME });
            const { Items } = await docClient.send(command);
            return createResponse(200, Items || []);

        } else if (path === "/videos" && httpMethod === "POST") {
            // ... (変更なし) ...
            // (POST /videos のロジックは長いため省略)
            const { playlistName, videoUrl, videoTitle } = body;
            // ... (以下、元のコードと同じ)

        // ★★★ここからが修正のポイント★★★
        // DELETE /playlists/{playlistId} という具体的なパスを先に評価する
        } else if (httpMethod === "DELETE" && path.match(/^\/playlists\/[^/]+$/)) {
            const playlistDeletePathMatch = path.match(/^\/playlists\/([^/]+)$/);
            const playlistId = playlistDeletePathMatch[1];

            try {
                const deleteCommand = new DeleteCommand({
                    TableName: PLAYLISTS_TABLE_NAME,
                    Key: { playlistId: playlistId },
                    ConditionExpression: "attribute_exists(playlistId)",
                });
                await docClient.send(deleteCommand);
                // 削除成功時は204 No Contentを返すのがより一般的ですが、200でも問題ありません。
                return createResponse(200, { message: "Playlist deleted successfully" });
            } catch (err) {
                if (err.name === 'ConditionalCheckFailedException') {
                    return createResponse(404, { error: "Playlist not found or already deleted" });
                }
                console.error("Error deleting playlist:", err);
                throw err;
            }

        // DELETE /playlists/{playlistId}/videos/{videoId} の評価を後にする
        } else if (httpMethod === "DELETE" && path.startsWith("/playlists/")) {
            const parts = path.split('/');
            if (parts.length === 5 && parts[3] === 'videos') {
                const playlistId = parts[2];
                const videoIdToDelete = parts[4];
                // ... (ビデオ削除のロジックは変更なし)
                const getCmd = new GetCommand({
                    TableName: PLAYLISTS_TABLE_NAME,
                    Key: { playlistId: playlistId }
                });
                const { Item: playlist } = await docClient.send(getCmd);
                if (!playlist || !playlist.videos) {
                    return createResponse(404, { error: "Playlist or videos not found" });
                }
                const updatedVideos = playlist.videos.filter(video => video.videoId !== videoIdToDelete);
                if (updatedVideos.length === playlist.videos.length) {
                    return createResponse(404, { error: "Video ID not found in playlist" });
                }
                const updateCmd = new UpdateCommand({
                    TableName: PLAYLISTS_TABLE_NAME,
                    Key: { playlistId: playlistId },
                    UpdateExpression: "SET videos = :videos",
                    ExpressionAttributeValues: { ":videos": updatedVideos },
                    ReturnValues: "UPDATED_NEW"
                });
                await docClient.send(updateCmd);
                return createResponse(200, { message: "Video deleted successfully" });
            }
        
        // --- ここから下は元のコードと同じ ---
        } else if (httpMethod === "PUT" && path.match(/^\/playlists\/[^/]+\/videos\/[^/]+\/title$/)) {
            // ... (PUT video title のロジック)
        
        } else if (httpMethod === "PUT" && path.match(/^\/playlists\/[^/]+\/name$/)) {
            // ... (PUT playlist name のロジック)
        }

        // 上記のどの条件にも一致しない場合
        return createResponse(404, { error: "Not Found" });

    } catch (error) {
        console.error("Error processing request:", error);
        return createResponse(500, { error: "Internal Server Error", details: error.message });
    }
};
