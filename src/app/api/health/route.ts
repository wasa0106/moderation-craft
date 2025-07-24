/**
 * ヘルスチェックエンドポイント
 * ネットワーク接続の確認に使用
 */

export async function GET() {
  return Response.json({ status: 'ok', timestamp: new Date().toISOString() })
}

export async function HEAD() {
  return new Response(null, { status: 200 })
}