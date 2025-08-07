# Phase 2: 外部連携 - 詳細実装計画

## 概要
Phase 2では、Fitbit、OpenWeatherMapなどの外部APIとの統合を実装し、健康データと環境データを収集するパイプラインを構築します。

## Week 3: Fitbit API統合

### Day 1-2: OAuth2.0認証実装

#### Fitbit OAuth設定

**環境変数設定**:
```bash
# .env.production
FITBIT_CLIENT_ID=your_client_id
FITBIT_CLIENT_SECRET=your_client_secret
FITBIT_REDIRECT_URI=https://app.moderation-craft.com/auth/fitbit/callback
FITBIT_SCOPE=activity heartrate location profile settings sleep weight
```

#### 認証フロー実装

**fitbit-auth/index.js**:
```javascript
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const crypto = require('crypto');

const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

class FitbitAuth {
  constructor() {
    this.tokenTable = 'moderation-craft-tokens';
  }
  
  async getCredentials() {
    const command = new GetSecretValueCommand({
      SecretId: 'fitbit-api-credentials'
    });
    
    const response = await secretsClient.send(command);
    return JSON.parse(response.SecretString);
  }
  
  generateAuthUrl(userId) {
    const state = crypto.randomBytes(16).toString('hex');
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    
    // PKCE情報を保存
    this.savePKCE(userId, state, codeVerifier);
    
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.FITBIT_CLIENT_ID,
      redirect_uri: process.env.FITBIT_REDIRECT_URI,
      scope: process.env.FITBIT_SCOPE,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state: state
    });
    
    return `https://www.fitbit.com/oauth2/authorize?${params.toString()}`;
  }
  
  async savePKCE(userId, state, codeVerifier) {
    const params = {
      TableName: this.tokenTable,
      Item: {
        user_id: userId,
        state: state,
        code_verifier: codeVerifier,
        created_at: new Date().toISOString(),
        ttl: Math.floor(Date.now() / 1000) + 600 // 10分後に期限切れ
      }
    };
    
    await docClient.send(new PutCommand(params));
  }
  
  async exchangeCodeForToken(code, state, userId) {
    // PKCE情報を取得
    const pkceData = await this.getPKCE(userId, state);
    if (!pkceData) {
      throw new Error('Invalid state or expired PKCE');
    }
    
    const credentials = await this.getCredentials();
    
    const tokenResponse = await fetch('https://api.fitbit.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(
          `${credentials.client_id}:${credentials.client_secret}`
        ).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: process.env.FITBIT_REDIRECT_URI,
        code_verifier: pkceData.code_verifier
      })
    });
    
    if (!tokenResponse.ok) {
      throw new Error(`Token exchange failed: ${tokenResponse.statusText}`);
    }
    
    const tokens = await tokenResponse.json();
    await this.saveTokens(userId, tokens);
    
    return tokens;
  }
  
  async saveTokens(userId, tokens) {
    const params = {
      TableName: this.tokenTable,
      Item: {
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        scope: tokens.scope,
        updated_at: new Date().toISOString()
      }
    };
    
    await docClient.send(new PutCommand(params));
  }
  
  async refreshToken(userId) {
    const tokens = await this.getTokens(userId);
    const credentials = await this.getCredentials();
    
    const response = await fetch('https://api.fitbit.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(
          `${credentials.client_id}:${credentials.client_secret}`
        ).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token
      })
    });
    
    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.statusText}`);
    }
    
    const newTokens = await response.json();
    await this.saveTokens(userId, newTokens);
    
    return newTokens;
  }
  
  async getValidToken(userId) {
    const tokens = await this.getTokens(userId);
    
    if (!tokens) {
      throw new Error('No tokens found for user');
    }
    
    const expiresAt = new Date(tokens.expires_at);
    const now = new Date();
    
    // トークンが期限切れまたは5分以内に期限切れになる場合は更新
    if (expiresAt <= new Date(now.getTime() + 5 * 60 * 1000)) {
      const newTokens = await this.refreshToken(userId);
      return newTokens.access_token;
    }
    
    return tokens.access_token;
  }
}

module.exports = FitbitAuth;
```

### Day 3-4: データ取得Lambda開発

#### Fitbitデータ取得関数

**fitbit-data-fetcher/index.js**:
```javascript
const FitbitAuth = require('./fitbit-auth');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({ region: process.env.AWS_REGION });
const fitbitAuth = new FitbitAuth();

exports.handler = async (event) => {
  const userId = event.userId || process.env.DEFAULT_USER_ID;
  const date = event.date || new Date().toISOString().split('T')[0];
  
  try {
    console.log(`Fetching Fitbit data for user ${userId} on ${date}`);
    
    // 有効なアクセストークンを取得
    const accessToken = await fitbitAuth.getValidToken(userId);
    
    // 各種データを並列で取得
    const [sleep, activity, heartRate, stress] = await Promise.all([
      fetchSleepData(accessToken, date),
      fetchActivityData(accessToken, date),
      fetchHeartRateData(accessToken, date),
      fetchStressData(accessToken, date)
    ]);
    
    // データを統合
    const integratedData = {
      user_id: userId,
      date: date,
      fetched_at: new Date().toISOString(),
      sleep: sleep,
      activity: activity,
      heart_rate: heartRate,
      stress: stress
    };
    
    // S3に保存
    await saveToS3(integratedData, userId, date);
    
    // ログ記録（簡易的な成功記録）
    console.log('Fitbit data fetch completed:', {
      userId,
      date,
      dataTypes: {
        sleep: !!sleep,
        activity: !!activity,
        heartRate: !!heartRate,
        stress: !!stress
      }
    });
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Fitbit data fetched successfully',
        userId: userId,
        date: date
      })
    };
  } catch (error) {
    console.error('Failed to fetch Fitbit data:', {
      userId,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};

async function fetchSleepData(token, date) {
  const response = await fetch(
    `https://api.fitbit.com/1.2/user/-/sleep/date/${date}.json`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept-Language': 'ja_JP'
      }
    }
  );
  
  if (!response.ok) {
    console.error(`Sleep data fetch failed: ${response.status}`);
    return null;
  }
  
  const data = await response.json();
  
  // データを正規化
  return {
    total_minutes: data.summary?.totalMinutesAsleep || 0,
    efficiency: data.summary?.efficiency || 0,
    stages: {
      deep: data.summary?.stages?.deep || 0,
      light: data.summary?.stages?.light || 0,
      rem: data.summary?.stages?.rem || 0,
      wake: data.summary?.stages?.wake || 0
    },
    start_time: data.sleep?.[0]?.startTime || null,
    end_time: data.sleep?.[0]?.endTime || null
  };
}

async function fetchActivityData(token, date) {
  const response = await fetch(
    `https://api.fitbit.com/1/user/-/activities/date/${date}.json`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept-Language': 'ja_JP'
      }
    }
  );
  
  if (!response.ok) {
    console.error(`Activity data fetch failed: ${response.status}`);
    return null;
  }
  
  const data = await response.json();
  
  return {
    steps: data.summary?.steps || 0,
    distance: data.summary?.distances?.[0]?.distance || 0,
    calories: data.summary?.caloriesOut || 0,
    active_minutes: data.summary?.veryActiveMinutes || 0,
    sedentary_minutes: data.summary?.sedentaryMinutes || 0,
    floors: data.summary?.floors || 0
  };
}

async function fetchHeartRateData(token, date) {
  const response = await fetch(
    `https://api.fitbit.com/1/user/-/activities/heart/date/${date}/1d.json`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept-Language': 'ja_JP'
      }
    }
  );
  
  if (!response.ok) {
    console.error(`Heart rate data fetch failed: ${response.status}`);
    return null;
  }
  
  const data = await response.json();
  
  return {
    resting_heart_rate: data['activities-heart']?.[0]?.value?.restingHeartRate || null,
    zones: data['activities-heart']?.[0]?.value?.heartRateZones || [],
    variability: data['activities-heart']?.[0]?.value?.heartRateVariability || null
  };
}

async function fetchStressData(token, date) {
  // Fitbit Premium APIの場合
  const response = await fetch(
    `https://api.fitbit.com/1/user/-/stress/date/${date}.json`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept-Language': 'ja_JP'
      }
    }
  );
  
  if (!response.ok) {
    // Premium APIでない場合はnullを返す
    if (response.status === 403) {
      console.log('Stress data requires Fitbit Premium');
      return null;
    }
    console.error(`Stress data fetch failed: ${response.status}`);
    return null;
  }
  
  const data = await response.json();
  
  return {
    daily_score: data.summary?.daily_score || null,
    responsiveness_score: data.summary?.responsiveness_score || null
  };
}

async function saveToS3(data, userId, date) {
  const key = `raw/external/fitbit/integrated/dt=${date}/user_${userId}.json`;
  
  const command = new PutObjectCommand({
    Bucket: process.env.BUCKET_NAME,
    Key: key,
    Body: JSON.stringify(data, null, 2),
    ContentType: 'application/json',
    Metadata: {
      'user-id': userId,
      'data-date': date,
      'source': 'fitbit-api'
    }
  });
  
  await s3Client.send(command);
  console.log(`Data saved to S3: ${key}`);
}

```

### Day 5: エラーハンドリングとリトライ機構

#### リトライ戦略実装

**retry-handler.js**:
```javascript
class RetryHandler {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000;
    this.maxDelay = options.maxDelay || 30000;
    this.exponentialBase = options.exponentialBase || 2;
  }
  
  async executeWithRetry(fn, context = {}) {
    let lastError;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        // リトライ不可能なエラーの場合は即座に失敗
        if (this.isNonRetryableError(error)) {
          throw error;
        }
        
        if (attempt < this.maxRetries) {
          const delay = this.calculateDelay(attempt, error);
          console.log(`Retry attempt ${attempt + 1}/${this.maxRetries} after ${delay}ms`);
          await this.sleep(delay);
        }
      }
    }
    
    throw new Error(`Failed after ${this.maxRetries} retries: ${lastError.message}`);
  }
  
  isNonRetryableError(error) {
    // 認証エラーや権限エラーはリトライしない
    const nonRetryableStatuses = [401, 403, 404];
    return nonRetryableStatuses.includes(error.statusCode);
  }
  
  calculateDelay(attempt, error) {
    // レート制限の場合はRetry-Afterヘッダーを確認
    if (error.statusCode === 429 && error.headers?.['retry-after']) {
      return parseInt(error.headers['retry-after']) * 1000;
    }
    
    // 指数バックオフ
    const exponentialDelay = this.baseDelay * Math.pow(this.exponentialBase, attempt);
    
    // ジッターを追加（最大20%）
    const jitter = exponentialDelay * 0.2 * Math.random();
    
    return Math.min(exponentialDelay + jitter, this.maxDelay);
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = RetryHandler;
```

## Week 4: 天候API統合

### Day 1-2: OpenWeatherMap接続

#### 天候データ取得実装

**weather-fetcher/index.js**:
```javascript
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const RetryHandler = require('./retry-handler');

const s3Client = new S3Client({ region: process.env.AWS_REGION });
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION });
const retryHandler = new RetryHandler({ maxRetries: 3 });

exports.handler = async (event) => {
  const locations = event.locations || JSON.parse(process.env.DEFAULT_LOCATIONS);
  const date = new Date().toISOString().split('T')[0];
  
  try {
    const apiKey = await getApiKey();
    const results = [];
    
    for (const location of locations) {
      const weatherData = await retryHandler.executeWithRetry(async () => {
        return await fetchWeatherData(apiKey, location);
      });
      
      const processedData = processWeatherData(weatherData, location);
      await saveToS3(processedData, location.id, date);
      
      results.push({
        locationId: location.id,
        status: 'success'
      });
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Weather data fetched successfully',
        results: results
      })
    };
  } catch (error) {
    console.error('Weather fetch failed:', error);
    throw error;
  }
};

async function getApiKey() {
  const command = new GetSecretValueCommand({
    SecretId: 'openweather-api-key'
  });
  
  const response = await secretsClient.send(command);
  return JSON.parse(response.SecretString).api_key;
}

async function fetchWeatherData(apiKey, location) {
  const endpoints = {
    current: `https://api.openweathermap.org/data/2.5/weather`,
    forecast: `https://api.openweathermap.org/data/2.5/forecast`,
    airQuality: `https://api.openweathermap.org/data/2.5/air_pollution`
  };
  
  const requests = Object.entries(endpoints).map(async ([key, url]) => {
    const params = new URLSearchParams({
      lat: location.latitude,
      lon: location.longitude,
      appid: apiKey,
      units: 'metric',
      lang: 'ja'
    });
    
    const response = await fetch(`${url}?${params}`);
    
    if (!response.ok) {
      const error = new Error(`Weather API error: ${response.statusText}`);
      error.statusCode = response.status;
      error.headers = Object.fromEntries(response.headers.entries());
      throw error;
    }
    
    return { [key]: await response.json() };
  });
  
  const results = await Promise.all(requests);
  return Object.assign({}, ...results);
}

function processWeatherData(data, location) {
  const current = data.current;
  const forecast = data.forecast;
  const airQuality = data.airQuality;
  
  return {
    location_id: location.id,
    location_name: location.name,
    coordinates: {
      latitude: location.latitude,
      longitude: location.longitude
    },
    fetched_at: new Date().toISOString(),
    current: {
      temperature: current.main?.temp || null,
      feels_like: current.main?.feels_like || null,
      humidity: current.main?.humidity || null,
      pressure: current.main?.pressure || null,
      wind_speed: current.wind?.speed || null,
      wind_direction: current.wind?.deg || null,
      clouds: current.clouds?.all || null,
      visibility: current.visibility || null,
      weather: {
        main: current.weather?.[0]?.main || null,
        description: current.weather?.[0]?.description || null,
        icon: current.weather?.[0]?.icon || null
      },
      sunrise: current.sys?.sunrise ? new Date(current.sys.sunrise * 1000).toISOString() : null,
      sunset: current.sys?.sunset ? new Date(current.sys.sunset * 1000).toISOString() : null
    },
    forecast_24h: forecast.list?.slice(0, 8).map(item => ({
      time: new Date(item.dt * 1000).toISOString(),
      temperature: item.main?.temp || null,
      humidity: item.main?.humidity || null,
      weather: item.weather?.[0]?.main || null,
      precipitation: item.rain?.['3h'] || 0
    })) || [],
    air_quality: {
      aqi: airQuality.list?.[0]?.main?.aqi || null,
      components: {
        pm2_5: airQuality.list?.[0]?.components?.pm2_5 || null,
        pm10: airQuality.list?.[0]?.components?.pm10 || null,
        no2: airQuality.list?.[0]?.components?.no2 || null,
        o3: airQuality.list?.[0]?.components?.o3 || null,
        co: airQuality.list?.[0]?.components?.co || null
      }
    }
  };
}

async function saveToS3(data, locationId, date) {
  const hour = new Date().getHours();
  const key = `raw/external/weather/hourly/dt=${date}/location_${locationId}_hour_${hour}.json`;
  
  const command = new PutObjectCommand({
    Bucket: process.env.BUCKET_NAME,
    Key: key,
    Body: JSON.stringify(data, null, 2),
    ContentType: 'application/json',
    Metadata: {
      'location-id': locationId,
      'data-date': date,
      'source': 'openweathermap-api'
    }
  });
  
  await s3Client.send(command);
  console.log(`Weather data saved to S3: ${key}`);
}
```

### Day 3-4: データ正規化処理

#### 統一スキーマへの変換

**data-normalizer/index.js**:
```javascript
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({ region: process.env.AWS_REGION });

class DataNormalizer {
  constructor() {
    this.schemas = {
      fitbit: this.normalizeFitbitData.bind(this),
      weather: this.normalizeWeatherData.bind(this),
      calendar: this.normalizeCalendarData.bind(this)
    };
  }
  
  async normalizeData(source, rawData) {
    if (!this.schemas[source]) {
      throw new Error(`Unknown data source: ${source}`);
    }
    
    return this.schemas[source](rawData);
  }
  
  normalizeFitbitData(data) {
    return {
      source: 'fitbit',
      timestamp: data.fetched_at,
      user_id: data.user_id,
      date: data.date,
      health_metrics: {
        sleep: {
          duration_hours: (data.sleep?.total_minutes || 0) / 60,
          efficiency_percent: data.sleep?.efficiency || null,
          deep_sleep_hours: (data.sleep?.stages?.deep || 0) / 60,
          rem_sleep_hours: (data.sleep?.stages?.rem || 0) / 60,
          quality_score: this.calculateSleepQuality(data.sleep)
        },
        activity: {
          steps: data.activity?.steps || 0,
          distance_km: data.activity?.distance || 0,
          calories_burned: data.activity?.calories || 0,
          active_minutes: data.activity?.active_minutes || 0,
          sedentary_percent: this.calculateSedentaryPercent(data.activity)
        },
        vitals: {
          resting_heart_rate: data.heart_rate?.resting_heart_rate || null,
          heart_rate_variability: data.heart_rate?.variability || null,
          stress_level: this.normalizeStressLevel(data.stress?.daily_score)
        }
      }
    };
  }
  
  normalizeWeatherData(data) {
    return {
      source: 'weather',
      timestamp: data.fetched_at,
      location_id: data.location_id,
      date: new Date(data.fetched_at).toISOString().split('T')[0],
      environmental_metrics: {
        temperature: {
          current: data.current?.temperature || null,
          feels_like: data.current?.feels_like || null,
          daily_range: this.calculateDailyRange(data.forecast_24h)
        },
        humidity: data.current?.humidity || null,
        pressure: data.current?.pressure || null,
        air_quality: {
          index: data.air_quality?.aqi || null,
          level: this.getAirQualityLevel(data.air_quality?.aqi),
          pm2_5: data.air_quality?.components?.pm2_5 || null
        },
        daylight: {
          sunrise: data.current?.sunrise || null,
          sunset: data.current?.sunset || null,
          hours: this.calculateDaylightHours(data.current)
        },
        conditions: {
          main: data.current?.weather?.main || null,
          description: data.current?.weather?.description || null,
          comfort_index: this.calculateComfortIndex(data.current)
        }
      }
    };
  }
  
  normalizeCalendarData(data) {
    return {
      source: 'calendar',
      timestamp: new Date().toISOString(),
      user_id: data.user_id,
      date: data.date,
      schedule_metrics: {
        events_count: data.events?.length || 0,
        meeting_hours: this.calculateMeetingHours(data.events),
        focus_blocks: this.identifyFocusBlocks(data.events),
        busy_score: this.calculateBusyScore(data.events)
      }
    };
  }
  
  // ヘルパー関数
  calculateSleepQuality(sleep) {
    if (!sleep) return null;
    
    const factors = [
      sleep.efficiency / 100,
      Math.min(sleep.total_minutes / 480, 1), // 8時間を100%とする
      sleep.stages?.deep > 0 ? 0.3 : 0,
      sleep.stages?.rem > 0 ? 0.2 : 0
    ];
    
    return Math.round(factors.reduce((a, b) => a + b, 0) / factors.length * 100);
  }
  
  calculateSedentaryPercent(activity) {
    if (!activity) return null;
    
    const totalMinutes = 1440; // 24時間
    const activeMinutes = activity.active_minutes || 0;
    const sedentaryMinutes = activity.sedentary_minutes || 0;
    
    return Math.round((sedentaryMinutes / totalMinutes) * 100);
  }
  
  normalizeStressLevel(score) {
    if (score === null || score === undefined) return null;
    
    if (score >= 80) return 'low';
    if (score >= 50) return 'medium';
    return 'high';
  }
  
  calculateDailyRange(forecast) {
    if (!forecast || forecast.length === 0) return { min: null, max: null };
    
    const temps = forecast.map(f => f.temperature).filter(t => t !== null);
    return {
      min: Math.min(...temps),
      max: Math.max(...temps)
    };
  }
  
  getAirQualityLevel(aqi) {
    if (aqi === null) return null;
    
    if (aqi <= 50) return 'good';
    if (aqi <= 100) return 'moderate';
    if (aqi <= 150) return 'unhealthy_sensitive';
    if (aqi <= 200) return 'unhealthy';
    if (aqi <= 300) return 'very_unhealthy';
    return 'hazardous';
  }
  
  calculateDaylightHours(current) {
    if (!current?.sunrise || !current?.sunset) return null;
    
    const sunrise = new Date(current.sunrise);
    const sunset = new Date(current.sunset);
    const hours = (sunset - sunrise) / (1000 * 60 * 60);
    
    return Math.round(hours * 10) / 10;
  }
  
  calculateComfortIndex(current) {
    if (!current?.temperature || !current?.humidity) return null;
    
    const temp = current.temperature;
    const humidity = current.humidity;
    
    // 不快指数の計算
    const discomfortIndex = 0.81 * temp + 0.01 * humidity * (0.99 * temp - 14.3) + 46.3;
    
    if (discomfortIndex < 55) return 'cold';
    if (discomfortIndex < 60) return 'cool';
    if (discomfortIndex < 65) return 'comfortable';
    if (discomfortIndex < 70) return 'slightly_warm';
    if (discomfortIndex < 75) return 'warm';
    if (discomfortIndex < 80) return 'hot';
    return 'very_hot';
  }
  
  calculateMeetingHours(events) {
    if (!events || events.length === 0) return 0;
    
    return events
      .filter(e => e.type === 'meeting')
      .reduce((total, event) => {
        const duration = (new Date(event.end) - new Date(event.start)) / (1000 * 60 * 60);
        return total + duration;
      }, 0);
  }
  
  identifyFocusBlocks(events) {
    if (!events || events.length === 0) return [];
    
    // 2時間以上の空き時間を検出
    const focusBlocks = [];
    const sortedEvents = events.sort((a, b) => new Date(a.start) - new Date(b.start));
    
    for (let i = 0; i < sortedEvents.length - 1; i++) {
      const gap = new Date(sortedEvents[i + 1].start) - new Date(sortedEvents[i].end);
      const hours = gap / (1000 * 60 * 60);
      
      if (hours >= 2) {
        focusBlocks.push({
          start: sortedEvents[i].end,
          end: sortedEvents[i + 1].start,
          duration_hours: hours
        });
      }
    }
    
    return focusBlocks;
  }
  
  calculateBusyScore(events) {
    if (!events || events.length === 0) return 0;
    
    const totalHours = events.reduce((total, event) => {
      const duration = (new Date(event.end) - new Date(event.start)) / (1000 * 60 * 60);
      return total + duration;
    }, 0);
    
    // 8時間を100%とする
    return Math.min(Math.round((totalHours / 8) * 100), 100);
  }
}

// Lambda ハンドラー
exports.handler = async (event) => {
  const normalizer = new DataNormalizer();
  const { source, inputKey } = event;
  
  try {
    // S3から生データを取得
    const getCommand = new GetObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: inputKey
    });
    
    const response = await s3Client.send(getCommand);
    const rawData = JSON.parse(await response.Body.transformToString());
    
    // データを正規化
    const normalizedData = await normalizer.normalizeData(source, rawData);
    
    // 正規化データを保存
    const outputKey = inputKey.replace('/raw/', '/staging/normalized/');
    const putCommand = new PutObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: outputKey,
      Body: JSON.stringify(normalizedData, null, 2),
      ContentType: 'application/json'
    });
    
    await s3Client.send(putCommand);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Data normalized successfully',
        inputKey: inputKey,
        outputKey: outputKey
      })
    };
  } catch (error) {
    console.error('Normalization failed:', error);
    throw error;
  }
};

module.exports = DataNormalizer;
```

## Week 5: データ標準化

### Day 1-3: スキーマ定義とバリデーション

#### JSONスキーマ定義

**schemas/unified-schema.json**:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Unified Data Schema",
  "type": "object",
  "required": ["source", "timestamp", "date"],
  "properties": {
    "source": {
      "type": "string",
      "enum": ["fitbit", "weather", "calendar", "github", "spotify"]
    },
    "timestamp": {
      "type": "string",
      "format": "date-time"
    },
    "date": {
      "type": "string",
      "format": "date"
    },
    "user_id": {
      "type": "string"
    },
    "location_id": {
      "type": "string"
    },
    "health_metrics": {
      "$ref": "#/definitions/healthMetrics"
    },
    "environmental_metrics": {
      "$ref": "#/definitions/environmentalMetrics"
    },
    "schedule_metrics": {
      "$ref": "#/definitions/scheduleMetrics"
    }
  },
  "definitions": {
    "healthMetrics": {
      "type": "object",
      "properties": {
        "sleep": {
          "type": "object",
          "properties": {
            "duration_hours": { "type": "number", "minimum": 0, "maximum": 24 },
            "efficiency_percent": { "type": "number", "minimum": 0, "maximum": 100 },
            "deep_sleep_hours": { "type": "number", "minimum": 0 },
            "rem_sleep_hours": { "type": "number", "minimum": 0 },
            "quality_score": { "type": "number", "minimum": 0, "maximum": 100 }
          }
        },
        "activity": {
          "type": "object",
          "properties": {
            "steps": { "type": "integer", "minimum": 0 },
            "distance_km": { "type": "number", "minimum": 0 },
            "calories_burned": { "type": "number", "minimum": 0 },
            "active_minutes": { "type": "integer", "minimum": 0 },
            "sedentary_percent": { "type": "number", "minimum": 0, "maximum": 100 }
          }
        },
        "vitals": {
          "type": "object",
          "properties": {
            "resting_heart_rate": { "type": ["number", "null"], "minimum": 30, "maximum": 200 },
            "heart_rate_variability": { "type": ["number", "null"], "minimum": 0 },
            "stress_level": { 
              "type": ["string", "null"],
              "enum": ["low", "medium", "high", null]
            }
          }
        }
      }
    },
    "environmentalMetrics": {
      "type": "object",
      "properties": {
        "temperature": {
          "type": "object",
          "properties": {
            "current": { "type": ["number", "null"] },
            "feels_like": { "type": ["number", "null"] },
            "daily_range": {
              "type": "object",
              "properties": {
                "min": { "type": ["number", "null"] },
                "max": { "type": ["number", "null"] }
              }
            }
          }
        },
        "humidity": { "type": ["number", "null"], "minimum": 0, "maximum": 100 },
        "pressure": { "type": ["number", "null"], "minimum": 800, "maximum": 1200 },
        "air_quality": {
          "type": "object",
          "properties": {
            "index": { "type": ["integer", "null"], "minimum": 0 },
            "level": {
              "type": ["string", "null"],
              "enum": ["good", "moderate", "unhealthy_sensitive", "unhealthy", "very_unhealthy", "hazardous", null]
            },
            "pm2_5": { "type": ["number", "null"], "minimum": 0 }
          }
        }
      }
    }
  }
}
```

### Day 4-5: 統合テスト

#### E2Eテストスクリプト

**e2e-test.sh**:
```bash
#!/bin/bash

echo "Running Phase 2 E2E tests..."

# テスト用ユーザーID
TEST_USER_ID="test-user-001"
TEST_DATE=$(date +%Y-%m-%d)

# 1. Fitbit認証フロー
echo "Testing Fitbit OAuth flow..."
AUTH_URL=$(aws lambda invoke \
  --function-name fitbit-auth-url \
  --payload "{\"userId\": \"$TEST_USER_ID\"}" \
  response.json \
  --query 'Payload' --output text | jq -r '.authUrl')

echo "Auth URL generated: $AUTH_URL"

# 2. Fitbitデータ取得
echo "Testing Fitbit data fetch..."
aws lambda invoke \
  --function-name fitbit-data-fetcher \
  --payload "{\"userId\": \"$TEST_USER_ID\", \"date\": \"$TEST_DATE\"}" \
  fitbit-response.json

if grep -q "success" fitbit-response.json; then
  echo "✅ Fitbit data fetch passed"
else
  echo "❌ Fitbit data fetch failed"
  exit 1
fi

# 3. 天候データ取得
echo "Testing weather data fetch..."
aws lambda invoke \
  --function-name weather-fetcher \
  --payload "{\"locations\": [{\"id\": \"tokyo\", \"name\": \"Tokyo\", \"latitude\": 35.6762, \"longitude\": 139.6503}]}" \
  weather-response.json

if grep -q "success" weather-response.json; then
  echo "✅ Weather data fetch passed"
else
  echo "❌ Weather data fetch failed"
  exit 1
fi

# 4. データ正規化
echo "Testing data normalization..."
FITBIT_KEY="raw/external/fitbit/integrated/dt=$TEST_DATE/user_$TEST_USER_ID.json"

aws lambda invoke \
  --function-name data-normalizer \
  --payload "{\"source\": \"fitbit\", \"inputKey\": \"$FITBIT_KEY\"}" \
  normalize-response.json

if grep -q "normalized successfully" normalize-response.json; then
  echo "✅ Data normalization passed"
else
  echo "❌ Data normalization failed"
  exit 1
fi

# 5. S3データ確認
echo "Verifying S3 data..."
aws s3 ls s3://moderation-craft-data/staging/normalized/ --recursive

echo "✅ All Phase 2 tests passed!"
```

## 成果物チェックリスト

### Week 3 完了基準
- [ ] Fitbit OAuth実装完了
- [ ] トークン管理システム稼働
- [ ] 全健康データタイプ取得可能
- [ ] エラーハンドリング実装

### Week 4 完了基準
- [ ] OpenWeatherMap API統合
- [ ] 天候データ定期取得
- [ ] データ正規化パイプライン稼働

### Week 5 完了基準
- [ ] 統一スキーマ定義完了
- [ ] バリデーション実装
- [ ] 全外部APIの統合テスト合格
- [ ] ドキュメント完成

## 次のフェーズへの準備

### Phase 3に必要な事前準備
1. dbt Coreのインストール
2. DuckDB WASMの調査
3. SQLモデリングの学習
4. パフォーマンスチューニング戦略

---

*最終更新: 2024年2月*
*Phase 2 リード: インテグレーションチーム*