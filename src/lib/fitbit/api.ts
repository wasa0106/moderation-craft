/**
 * Fitbit API呼び出しライブラリ
 * Fitbit APIからデータを取得する各種メソッドを提供
 * APIプロキシルート経由でサーバーサイドからAPIを呼び出します
 */

import { fitbitAuth } from './auth';
import type {
  FitbitProfile,
  FitbitSleepData,
  FitbitActivityData,
  FitbitHeartRateData,
  FitbitError,
  NormalizedHealthData,
} from './types';

/**
 * Fitbit APIクライアントクラス
 */
export class FitbitApiClient {
  private proxyUrl = '/api/fitbit/data'; // APIプロキシルート
  private version = '1.2'; // Fitbit API version

  /**
   * APIリクエストの共通処理
   * プロキシルート経由でFitbit APIを呼び出します
   * @param endpoint エンドポイント
   * @param options リクエストオプション
   * @returns レスポンスデータ
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // 有効なアクセストークンを取得
    const accessToken = await fitbitAuth.getValidAccessToken();
    if (!accessToken) {
      throw new Error('No valid access token available. Please authenticate first.');
    }

    // プロキシ経由でリクエスト
    const url = `${this.proxyUrl}?endpoint=${encodeURIComponent(endpoint)}`;
    console.log(`[FitbitAPI] Requesting via proxy: ${endpoint}`);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          ...options.headers,
        },
      });

      // レート制限のチェック（プロキシ経由で返される）
      const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
      const rateLimitReset = response.headers.get('X-RateLimit-Reset');
      
      if (rateLimitRemaining) {
        console.log(`[FitbitAPI] Rate limit remaining: ${rateLimitRemaining}`);
      }
      if (rateLimitReset) {
        console.log(`[FitbitAPI] Rate limit resets at: ${new Date(parseInt(rateLimitReset) * 1000).toISOString()}`);
      }

      if (!response.ok) {
        const errorData = await response.json() as FitbitError;
        console.error('[FitbitAPI] Request failed:', errorData);
        
        // トークンが無効な場合は認証をクリア
        if (response.status === 401) {
          await fitbitAuth.logout();
          throw new Error('Authentication failed. Please re-authenticate.');
        }
        
        throw new Error(errorData.errors?.[0]?.message || 'Fitbit API request failed');
      }

      const data = await response.json() as T;
      console.log('[FitbitAPI] Request successful');
      return data;
    } catch (error) {
      console.error('[FitbitAPI] Request error:', error);
      throw error;
    }
  }

  /**
   * ユーザープロフィールを取得
   * @returns プロフィールデータ
   */
  async getProfile(): Promise<FitbitProfile> {
    console.log('[FitbitAPI] Getting user profile');
    return this.request<FitbitProfile>('/1/user/-/profile.json');
  }

  /**
   * 睡眠データを取得
   * @param date 取得する日付（YYYY-MM-DD形式）
   * @returns 睡眠データ
   */
  async getSleepData(date: string): Promise<FitbitSleepData> {
    console.log(`[FitbitAPI] Getting sleep data for ${date}`);
    return this.request<FitbitSleepData>(`/${this.version}/user/-/sleep/date/${date}.json`);
  }

  /**
   * 睡眠データを期間指定で取得
   * @param startDate 開始日（YYYY-MM-DD形式）
   * @param endDate 終了日（YYYY-MM-DD形式）
   * @returns 睡眠データ配列
   */
  async getSleepRange(startDate: string, endDate: string): Promise<FitbitSleepData> {
    console.log(`[FitbitAPI] Getting sleep data from ${startDate} to ${endDate}`);
    return this.request<FitbitSleepData>(
      `/${this.version}/user/-/sleep/date/${startDate}/${endDate}.json`
    );
  }

  /**
   * 活動データを取得
   * @param date 取得する日付（YYYY-MM-DD形式）
   * @returns 活動データ
   */
  async getActivityData(date: string): Promise<FitbitActivityData> {
    console.log(`[FitbitAPI] Getting activity data for ${date}`);
    return this.request<FitbitActivityData>(
      `/1/user/-/activities/date/${date}.json`
    );
  }

  /**
   * 心拍数データを取得
   * @param date 取得する日付（YYYY-MM-DD形式）
   * @param detailLevel 詳細レベル（1sec, 1min, 5min, 15min）
   * @returns 心拍数データ
   */
  async getHeartRateData(
    date: string,
    detailLevel: '1sec' | '1min' | '5min' | '15min' = '1min'
  ): Promise<FitbitHeartRateData> {
    console.log(`[FitbitAPI] Getting heart rate data for ${date} (${detailLevel} detail)`);
    return this.request<FitbitHeartRateData>(
      `/1/user/-/activities/heart/date/${date}/1d/${detailLevel}.json`
    );
  }

  /**
   * 歩数データを取得
   * @param date 取得する日付（YYYY-MM-DD形式）
   * @returns 歩数データ
   */
  async getStepsData(date: string): Promise<{ 'activities-steps': Array<{ dateTime: string; value: string }> }> {
    console.log(`[FitbitAPI] Getting steps data for ${date}`);
    return this.request(
      `/1/user/-/activities/steps/date/${date}/1d.json`
    );
  }

  /**
   * 消費カロリーデータを取得
   * @param date 取得する日付（YYYY-MM-DD形式）
   * @returns カロリーデータ
   */
  async getCaloriesData(date: string): Promise<{ 'activities-calories': Array<{ dateTime: string; value: string }> }> {
    console.log(`[FitbitAPI] Getting calories data for ${date}`);
    return this.request(
      `/1/user/-/activities/calories/date/${date}/1d.json`
    );
  }

  /**
   * 指定日の全ヘルスデータを取得して正規化
   * @param date 取得する日付（YYYY-MM-DD形式）
   * @returns 正規化されたヘルスデータ
   */
  async getAllHealthData(date: string): Promise<NormalizedHealthData> {
    console.log(`[FitbitAPI] Getting all health data for ${date}`);
    
    const authState = fitbitAuth.getAuthState();
    if (!authState.isAuthenticated || !authState.userId) {
      throw new Error('User not authenticated');
    }

    const normalized: NormalizedHealthData = {
      date,
      userId: authState.userId,
      source: 'fitbit',
    };

    try {
      // 並列でデータを取得
      const [sleepData, activityData, heartRateData] = await Promise.allSettled([
        this.getSleepData(date),
        this.getActivityData(date),
        this.getHeartRateData(date),
      ]);

      // 睡眠データの正規化
      if (sleepData.status === 'fulfilled' && sleepData.value.sleep.length > 0) {
        const mainSleep = sleepData.value.sleep.find(s => s.isMainSleep) || sleepData.value.sleep[0];
        normalized.sleep = {
          duration: mainSleep.minutesAsleep,
          efficiency: mainSleep.efficiency,
          deepSleep: mainSleep.levels.summary.deep?.minutes,
          remSleep: mainSleep.levels.summary.rem?.minutes,
          lightSleep: mainSleep.levels.summary.light?.minutes,
          awakeTime: mainSleep.minutesAwake,
        };
      }

      // 活動データの正規化
      if (activityData.status === 'fulfilled') {
        const summary = activityData.value.summary;
        normalized.activity = {
          steps: summary.steps,
          distance: summary.distances.find(d => d.activity === 'total')?.distance || 0,
          caloriesBurned: summary.caloriesOut,
          activeMinutes: summary.fairlyActiveMinutes + summary.veryActiveMinutes,
          floors: summary.floors,
        };
      }

      // 心拍数データの正規化
      if (heartRateData.status === 'fulfilled' && heartRateData.value['activities-heart'].length > 0) {
        const heartData = heartRateData.value['activities-heart'][0];
        const zones = heartData.value.heartRateZones;
        
        normalized.heartRate = {
          resting: heartData.value.restingHeartRate,
          average: zones.reduce((sum, z) => sum + (z.minutes * ((z.min + z.max) / 2)), 0) / 
                   zones.reduce((sum, z) => sum + z.minutes, 0) || undefined,
          max: zones[zones.length - 1]?.max,
          min: zones[0]?.min,
        };
      }

      console.log('[FitbitAPI] Successfully normalized health data');
      return normalized;
    } catch (error) {
      console.error('[FitbitAPI] Failed to get all health data:', error);
      throw error;
    }
  }

  /**
   * 期間指定で全ヘルスデータを取得
   * @param startDate 開始日（YYYY-MM-DD形式）
   * @param endDate 終了日（YYYY-MM-DD形式）
   * @returns 正規化されたヘルスデータの配列
   */
  async getHealthDataRange(startDate: string, endDate: string): Promise<NormalizedHealthData[]> {
    console.log(`[FitbitAPI] Getting health data from ${startDate} to ${endDate}`);
    
    const dates: string[] = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    
    // 日付の配列を生成
    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    
    console.log(`[FitbitAPI] Fetching data for ${dates.length} days`);
    
    // 各日のデータを並列で取得（ただしレート制限を考慮）
    const results: NormalizedHealthData[] = [];
    const batchSize = 5; // 一度に取得する日数
    
    for (let i = 0; i < dates.length; i += batchSize) {
      const batch = dates.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(date => this.getAllHealthData(date))
      );
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error('[FitbitAPI] Failed to fetch data:', result.reason);
        }
      }
      
      // レート制限を避けるため少し待機
      if (i + batchSize < dates.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`[FitbitAPI] Successfully fetched ${results.length} days of data`);
    return results;
  }

  /**
   * 最新のデータを同期
   * @param days 過去何日分のデータを同期するか（デフォルト: 7日）
   * @returns 同期したデータ
   */
  async syncRecentData(days: number = 7): Promise<NormalizedHealthData[]> {
    console.log(`[FitbitAPI] Syncing recent ${days} days of data`);
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1);
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    return this.getHealthDataRange(startDateStr, endDateStr);
  }
}

// シングルトンインスタンスをエクスポート
export const fitbitApi = new FitbitApiClient();