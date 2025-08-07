const https = require('https');

// Fitbit OAuth設定
const clientId = '23QQC2';
const clientSecret = '2d5a030ee0a6d4e5e4f6288c0342490f';
const redirectUri = 'http://localhost:3000/api/auth/fitbit/callback';

// ここに新しい認証コードを入力してください
const code = 'b317ecddfcc2fdb2b7127b95fb81c4fa720d7ebe';  // <-- ここを変更

// Base64エンコード
const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
console.log('Using Authorization:', `Basic ${auth}`);

// リクエストデータ
const data = new URLSearchParams({
  grant_type: 'authorization_code',
  code: code,
  redirect_uri: redirectUri
}).toString();

console.log('Request data:', data);

// HTTPSリクエストオプション
const options = {
  hostname: 'api.fitbit.com',
  path: '/oauth2/token',
  method: 'POST',
  headers: {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': data.length
  }
};

console.log('\n=== Fitbit Token Exchange ===');
console.log('Making request to:', `https://${options.hostname}${options.path}`);

// リクエスト実行
const req = https.request(options, (res) => {
  let body = '';

  res.on('data', (chunk) => {
    body += chunk;
  });

  res.on('end', () => {
    console.log('\n=== Response ===');
    console.log('Status Code:', res.statusCode);
    console.log('Headers:', res.headers);

    try {
      const response = JSON.parse(body);

      if (res.statusCode === 200) {
        console.log('\n✅ SUCCESS! Token obtained:');
        console.log('Access Token:', response.access_token ? response.access_token.substring(0, 50) + '...' : 'N/A');
        console.log('Refresh Token:', response.refresh_token ? response.refresh_token.substring(0, 20) + '...' : 'N/A');
        console.log('User ID:', response.user_id);
        console.log('Scope:', response.scope);
        console.log('Expires In:', response.expires_in, 'seconds');

        // トークンをファイルに保存（オプション）
        const fs = require('fs');
        fs.writeFileSync('fitbit-tokens.json', JSON.stringify(response, null, 2));
        console.log('\n💾 Tokens saved to fitbit-tokens.json');

        console.log('\n📝 Next step: Test the token with:');
        console.log(`curl -H "Authorization: Bearer ${response.access_token ? response.access_token.substring(0, 30) + '...' : 'TOKEN'}" https://api.fitbit.com/1/user/-/profile.json`);
      } else {
        console.log('\n❌ ERROR:', response);

        if (response.errors && response.errors[0]) {
          console.log('\nError Type:', response.errors[0].errorType);
          console.log('Message:', response.errors[0].message);

          if (response.errors[0].errorType === 'invalid_grant') {
            console.log('\n💡 Solution: Get a new authorization code by visiting:');
            console.log(`https://www.fitbit.com/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=activity%20heartrate%20sleep%20profile%20settings%20location&state=test${Date.now()}`);
          }
        }
      }
    } catch (e) {
      console.error('Failed to parse response:', e);
      console.log('Raw response:', body);
    }
  });
});

req.on('error', (error) => {
  console.error('Request failed:', error);
});

// リクエスト送信
req.write(data);
req.end();

console.log('\n⏳ Waiting for response...');
