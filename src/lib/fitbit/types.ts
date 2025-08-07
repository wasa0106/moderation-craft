/**
 * Fitbit API関連の型定義
 */

// OAuth認証関連
export interface FitbitTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  token_type: string;
  user_id: string;
}

export interface FitbitToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp
  userId: string;
  scope: string;
}

export interface FitbitAuthState {
  isAuthenticated: boolean;
  userId?: string;
  lastSync?: Date;
  error?: string;
}

// ユーザープロフィール
export interface FitbitProfile {
  user: {
    age: number;
    avatar: string;
    avatar150: string;
    avatar640: string;
    dateOfBirth: string;
    displayName: string;
    encodedId: string;
    firstName: string;
    fullName: string;
    gender: string;
    height: number;
    lastName: string;
    memberSince: string;
    timezone: string;
    weight: number;
  };
}

// 睡眠データ
export interface FitbitSleepData {
  sleep: FitbitSleepLog[];
  summary: FitbitSleepSummary;
}

export interface FitbitSleepLog {
  dateOfSleep: string;
  duration: number;
  efficiency: number;
  endTime: string;
  infoCode: number;
  isMainSleep: boolean;
  levels: {
    data: Array<{
      dateTime: string;
      level: string;
      seconds: number;
    }>;
    shortData: Array<{
      dateTime: string;
      level: string;
      seconds: number;
    }>;
    summary: {
      deep?: { count: number; minutes: number; thirtyDayAvgMinutes: number };
      light?: { count: number; minutes: number; thirtyDayAvgMinutes: number };
      rem?: { count: number; minutes: number; thirtyDayAvgMinutes: number };
      wake?: { count: number; minutes: number; thirtyDayAvgMinutes: number };
      asleep?: { count: number; minutes: number };
      awake?: { count: number; minutes: number };
      restless?: { count: number; minutes: number };
    };
  };
  logId: number;
  minutesAfterWakeup: number;
  minutesAsleep: number;
  minutesAwake: number;
  minutesToFallAsleep: number;
  startTime: string;
  timeInBed: number;
  type: string;
}

export interface FitbitSleepSummary {
  stages?: {
    deep: number;
    light: number;
    rem: number;
    wake: number;
  };
  totalMinutesAsleep: number;
  totalSleepRecords: number;
  totalTimeInBed: number;
}

// 活動データ
export interface FitbitActivityData {
  activities: FitbitActivity[];
  goals: {
    activeMinutes: number;
    caloriesOut: number;
    distance: number;
    floors: number;
    steps: number;
  };
  summary: FitbitActivitySummary;
}

export interface FitbitActivity {
  activityId: number;
  activityParentId: number;
  activityParentName: string;
  calories: number;
  description: string;
  distance?: number;
  duration: number;
  hasActiveZoneMinutes: boolean;
  hasStartTime: boolean;
  isFavorite: boolean;
  lastModified: string;
  logId: number;
  name: string;
  startDate: string;
  startTime: string;
  steps?: number;
}

export interface FitbitActivitySummary {
  activeScore: number;
  activityCalories: number;
  caloriesBMR: number;
  caloriesOut: number;
  distances: Array<{
    activity: string;
    distance: number;
  }>;
  elevation: number;
  fairlyActiveMinutes: number;
  floors: number;
  lightlyActiveMinutes: number;
  marginalCalories: number;
  restingHeartRate?: number;
  sedentaryMinutes: number;
  steps: number;
  veryActiveMinutes: number;
}

// 心拍数データ
export interface FitbitHeartRateData {
  'activities-heart': Array<{
    dateTime: string;
    value: {
      customHeartRateZones: any[];
      heartRateZones: Array<{
        caloriesOut: number;
        max: number;
        min: number;
        minutes: number;
        name: string;
      }>;
      restingHeartRate?: number;
    };
  }>;
  'activities-heart-intraday'?: {
    dataset: Array<{
      time: string;
      value: number;
    }>;
    datasetInterval: number;
    datasetType: string;
  };
}

// 正規化されたデータ（アプリ内で使用）
export interface NormalizedHealthData {
  date: string;
  userId: string;
  source: 'fitbit';
  sleep?: {
    duration: number; // minutes
    efficiency: number; // percentage
    deepSleep?: number; // minutes
    remSleep?: number; // minutes
    lightSleep?: number; // minutes
    awakeTime?: number; // minutes
  };
  activity?: {
    steps: number;
    distance: number; // km
    caloriesBurned: number;
    activeMinutes: number;
    floors?: number;
  };
  heartRate?: {
    resting?: number;
    average?: number;
    max?: number;
    min?: number;
  };
}

// APIエラー
export interface FitbitError {
  errors: Array<{
    errorType: string;
    fieldName?: string;
    message: string;
  }>;
  success: false;
}

// API設定
export interface FitbitApiConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
}

// 同期状態
export interface FitbitSyncStatus {
  lastSyncTime?: Date;
  isSyncing: boolean;
  syncedDataTypes: string[];
  errors?: string[];
}