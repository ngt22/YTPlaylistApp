// Lambda関数のindex.js
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'; // ★型をV2用に変更 (推奨)
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand, // または QueryCommand
} = require("@aws-sdk/lib-dynamodb");
const { randomUUID } = require('crypto'); // videoId生成用

// DynamoDBクライアントの初期化
const client = new DynamoDBClient({ region: "ap-southeast-2" }); // リージョンを適宜変更
const docClient = DynamoDBDocumentClient.from(client);

const PLAYLISTS_TABLE_NAME = process.env.PLAYLISTS_TABLE_NAME || 'YouTubePlaylistsTS'; // 環境変数から取得

// ヘルパー関数: レスポンスを生成
const createResponse = (statusCode, body) => {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*", // CORS設定 (開発用、本番ではより厳密に)
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token"
    },
    body: JSON.stringify(body),
  };
};

// YouTube URLからVideo IDを抽出する簡単な関数 (より堅牢な実装を推奨)
function extractYouTubeVideoId(url) {
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&#]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([^?&#]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^?&#]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([^?&#]+)/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null; // マッチしない場合はnull
}


exports.handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2>=> {
 console.log("Received event:", JSON.stringify(event, null, 2));
  const httpMethod = event.requestContext.http.method; // ★修正
  const path = event.requestContext.http.path;       // ★修正 (または event.rawPath でも可)
  const body = event.body ? JSON.parse(event.body) : {};
  // const userId = event.requestContext?.authorizer?.claims?.sub || 'defaultUser'; // Cognito認証などを使用する場合

  try {
    // OPTIONSメソッドはCORSプリフライトリクエスト用
    if (httpMethod === "OPTIONS") {
      return createResponse(200, { message: "CORS preflight" });
    }

    // ルーティング
    if (path === "/playlists" && httpMethod === "GET") {
      // 全プレイリスト取得 (実際にはユーザーIDでフィルタリング)
      const command = new ScanCommand({ TableName: PLAYLISTS_TABLE_NAME });
      const { Items } = await docClient.send(command);
      return createResponse(200, Items || []);
    } else if (path === "/videos" && httpMethod === "POST") {
      // 動画をプレイリストに追加または新規プレイリスト作成
      const { playlistName, videoUrl, videoTitle } = body;
      if (!playlistName || !videoUrl) {
        return createResponse(400, { error: "playlistName and videoUrl are required" });
      }

      const extractedVideoId = extractYouTubeVideoId(videoUrl);
      if (!extractedVideoId) {
          return createResponse(400, { error: "Invalid YouTube URL or unable to extract video ID." });
      }

      const newVideo = {
        videoId: randomUUID(), // 動画ごとにユニークなID
        url: videoUrl,
        title: videoTitle || `動画 - ${extractedVideoId}`, // タイトルがなければURLの一部など
        addedAt: new Date().toISOString(),
      };

      // playlistNameで既存のプレイリストを検索 (Scanは大規模テーブルには非効率。Queryを使うか、playlistIdをクライアントから渡す設計が良い)
      // ここでは簡単のため、playlistNameをIDの一部として扱うか、別途検索する
      // より良い設計: クライアントがplaylistIdを指定する。なければ新規作成フローへ。
      // 今回は、playlistName で検索し、なければ新規作成、あれば追加する簡易的なロジック
      const scanCommand = new ScanCommand({
        TableName: PLAYLISTS_TABLE_NAME,
        FilterExpression: "#nm = :name", // #nm は name のエイリアス
        ExpressionAttributeNames: { "#nm": "name" },
        ExpressionAttributeValues: { ":name": playlistName },
      });
      const { Items: existingPlaylists } = await docClient.send(scanCommand);

      let playlistId;
      if (existingPlaylists && existingPlaylists.length > 0) {
        // 既存のプレイリストに追加
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
        // 新規プレイリスト作成
        playlistId = randomUUID(); // 新しいプレイリストID
        const putCommand = new PutCommand({
          TableName: PLAYLISTS_TABLE_NAME,
          Item: {
            playlistId: playlistId,
            name: playlistName,
            videos: [newVideo],
            createdAt: new Date().toISOString(),
            // userId: userId, // 認証導入後
          },
        });
        await docClient.send(putCommand);
        return createResponse(201, { message: "New playlist created and video added", playlistId, video: newVideo });
      }
    } else if (path.startsWith("/playlists/") && httpMethod === "DELETE") {
        // 例: /playlists/{playlistId}/videos/{videoId}
        const parts = path.split('/');
        if (parts.length === 5 && parts[3] === 'videos') {
            const playlistId = parts[2];
            const videoIdToDelete = parts[4];

            // まずプレイリストを取得
            const getCmd = new GetCommand({
                TableName: PLAYLISTS_TABLE_NAME,
                Key: { playlistId: playlistId }
            });
            const { Item: playlist } = await docClient.send(getCmd);

            if (!playlist || !playlist.videos) {
                return createResponse(404, { error: "Playlist or videos not found" });
            }

            // videoIdToDelete に一致しない動画のみで新しい動画リストを作成
            const updatedVideos = playlist.videos.filter(video => video.videoId !== videoIdToDelete);

            if (updatedVideos.length === playlist.videos.length) {
                 return createResponse(404, { error: "Video ID not found in playlist" });
            }

            // 動画リストを更新
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
    // TODO: 他のCRUD操作 (プレイリストの更新、削除など)

    return createResponse(404, { error: "Not Found" });

  } catch (error) {
    console.error("Error processing request:", error);
    return createResponse(500, { error: "Internal Server Error", details: error.message });
  }
};
