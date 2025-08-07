# Phase 4: 高度な分析 - 詳細実装計画

## 概要
Phase 4では、相関分析、Hugging Face統合による機械学習、インタラクティブダッシュボードを実装します。

## Week 9-10: 相関分析実装

### 統計分析モデル

#### 相関分析dbtモデル

**models/marts/mart_wellness_correlation.sql**:
```sql
{{ config(
    materialized='table',
    post_hook="CREATE INDEX idx_wellness_user_date ON {{ this }} (user_id, date)"
) }}

WITH daily_metrics AS (
    SELECT
        p.user_id,
        p.date,
        -- 生産性指標
        p.total_work_minutes,
        p.completed_tasks,
        p.avg_session_duration,
        p.productivity_score,
        -- 健康指標
        h.sleep_score,
        h.activity_score,
        h.recovery_score,
        h.total_sleep_hours,
        h.steps,
        h.avg_resting_hr,
        -- 環境指標
        w.temperature_avg,
        w.humidity_avg,
        w.air_quality_index,
        w.daylight_hours
    FROM {{ ref('mart_productivity_daily') }} p
    LEFT JOIN {{ ref('int_daily_health_summary') }} h
        ON p.user_id = h.user_id AND p.date = h.date
    LEFT JOIN {{ ref('int_environmental_daily') }} w
        ON p.date = w.date
),

correlations AS (
    SELECT
        user_id,
        -- 睡眠と生産性の相関
        CORR(sleep_score, productivity_score) AS sleep_productivity_corr,
        CORR(total_sleep_hours, total_work_minutes) AS sleep_duration_work_corr,
        -- 活動と生産性の相関
        CORR(activity_score, productivity_score) AS activity_productivity_corr,
        CORR(steps, completed_tasks) AS steps_tasks_corr,
        -- 環境と生産性の相関
        CORR(temperature_avg, productivity_score) AS temp_productivity_corr,
        CORR(air_quality_index, productivity_score) AS air_productivity_corr,
        CORR(daylight_hours, total_work_minutes) AS daylight_work_corr,
        -- 回復と生産性の相関
        CORR(recovery_score, productivity_score) AS recovery_productivity_corr,
        CORR(avg_resting_hr, productivity_score) AS hr_productivity_corr,
        -- カウント
        COUNT(*) AS sample_size
    FROM daily_metrics
    GROUP BY user_id
    HAVING COUNT(*) >= 7  -- 最低7日分のデータが必要
)

SELECT
    m.*,
    c.sleep_productivity_corr,
    c.sleep_duration_work_corr,
    c.activity_productivity_corr,
    c.steps_tasks_corr,
    c.temp_productivity_corr,
    c.air_productivity_corr,
    c.daylight_work_corr,
    c.recovery_productivity_corr,
    c.hr_productivity_corr,
    -- 相関強度の分類
    CASE 
        WHEN ABS(c.sleep_productivity_corr) >= 0.7 THEN 'strong'
        WHEN ABS(c.sleep_productivity_corr) >= 0.4 THEN 'moderate'
        WHEN ABS(c.sleep_productivity_corr) >= 0.2 THEN 'weak'
        ELSE 'negligible'
    END AS sleep_correlation_strength,
    -- 最も強い相関要因
    CASE GREATEST(
        ABS(c.sleep_productivity_corr),
        ABS(c.activity_productivity_corr),
        ABS(c.temp_productivity_corr),
        ABS(c.recovery_productivity_corr)
    )
        WHEN ABS(c.sleep_productivity_corr) THEN 'sleep'
        WHEN ABS(c.activity_productivity_corr) THEN 'activity'
        WHEN ABS(c.temp_productivity_corr) THEN 'environment'
        WHEN ABS(c.recovery_productivity_corr) THEN 'recovery'
    END AS primary_factor
FROM daily_metrics m
LEFT JOIN correlations c
    ON m.user_id = c.user_id
```

### 統計分析関数

**src/lib/analytics/statistics.ts**:
```typescript
export class StatisticalAnalysis {
  /**
   * ピアソン相関係数の計算
   */
  static pearsonCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length) {
      throw new Error('Arrays must have the same length');
    }
    
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
    const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);
    const sumY2 = y.reduce((total, yi) => total + yi * yi, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt(
      (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
    );
    
    return denominator === 0 ? 0 : numerator / denominator;
  }
  
  /**
   * スピアマンの順位相関係数
   */
  static spearmanCorrelation(x: number[], y: number[]): number {
    const rankX = this.rank(x);
    const rankY = this.rank(y);
    return this.pearsonCorrelation(rankX, rankY);
  }
  
  /**
   * 偏相関係数の計算
   */
  static partialCorrelation(
    x: number[],
    y: number[],
    z: number[]
  ): number {
    const rxy = this.pearsonCorrelation(x, y);
    const rxz = this.pearsonCorrelation(x, z);
    const ryz = this.pearsonCorrelation(y, z);
    
    const numerator = rxy - rxz * ryz;
    const denominator = Math.sqrt((1 - rxz ** 2) * (1 - ryz ** 2));
    
    return denominator === 0 ? 0 : numerator / denominator;
  }
  
  /**
   * 時系列の自己相関
   */
  static autocorrelation(series: number[], lag: number): number {
    const n = series.length - lag;
    const mean = series.reduce((a, b) => a + b, 0) / series.length;
    
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < n; i++) {
      numerator += (series[i] - mean) * (series[i + lag] - mean);
    }
    
    for (let i = 0; i < series.length; i++) {
      denominator += (series[i] - mean) ** 2;
    }
    
    return denominator === 0 ? 0 : numerator / denominator;
  }
  
  private static rank(arr: number[]): number[] {
    const sorted = [...arr].sort((a, b) => a - b);
    return arr.map(val => sorted.indexOf(val) + 1);
  }
}
```

## Week 11: ML統合

### Hugging Face API統合

**src/lib/ml/hugging-face-client.ts**:
```typescript
interface PredictionRequest {
  inputs: any;
  parameters?: Record<string, any>;
}

export class HuggingFaceClient {
  private apiKey: string;
  private baseUrl = 'https://api-inference.huggingface.co/models';
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  /**
   * 生産性予測モデル
   */
  async predictProductivity(features: {
    sleepHours: number;
    sleepQuality: number;
    steps: number;
    heartRateVariability: number;
    temperature: number;
    humidity: number;
    dayOfWeek: number;
    previousDayProductivity: number;
  }): Promise<number> {
    // カスタム訓練済みモデルを使用
    const modelId = 'moderation-craft/productivity-predictor';
    
    const response = await fetch(`${this.baseUrl}/${modelId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: Object.values(features),
        parameters: {
          candidate_labels: ['low', 'medium', 'high'],
          multi_label: false
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Prediction failed: ${response.statusText}`);
    }
    
    const result = await response.json();
    return this.convertToProductivityScore(result);
  }
  
  /**
   * 異常検知モデル
   */
  async detectAnomalies(timeSeries: number[]): Promise<{
    isAnomaly: boolean[];
    scores: number[];
  }> {
    const modelId = 'facebook/timeseries-anomaly-detection';
    
    const response = await fetch(`${this.baseUrl}/${modelId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: timeSeries,
        parameters: {
          threshold: 0.95,
          window_size: 7
        }
      })
    });
    
    const result = await response.json();
    return {
      isAnomaly: result.anomalies,
      scores: result.anomaly_scores
    };
  }
  
  /**
   * 自然言語処理によるインサイト生成
   */
  async generateInsights(data: {
    correlations: Record<string, number>;
    trends: Record<string, number>;
    anomalies: string[];
  }): Promise<string> {
    const modelId = 'meta-llama/Llama-2-7b-chat-hf';
    
    const prompt = this.buildInsightPrompt(data);
    
    const response = await fetch(`${this.baseUrl}/${modelId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 200,
          temperature: 0.7,
          top_p: 0.95
        }
      })
    });
    
    const result = await response.json();
    return result[0].generated_text;
  }
  
  private convertToProductivityScore(prediction: any): number {
    const mapping: Record<string, number> = {
      'low': 30,
      'medium': 60,
      'high': 90
    };
    
    return mapping[prediction.label] || 50;
  }
  
  private buildInsightPrompt(data: any): string {
    return `
      Based on the following health and productivity data:
      
      Correlations:
      ${JSON.stringify(data.correlations, null, 2)}
      
      Trends:
      ${JSON.stringify(data.trends, null, 2)}
      
      Anomalies detected:
      ${data.anomalies.join(', ')}
      
      Please provide 3 actionable insights to improve productivity:
    `;
  }
}
```

### 予測モデル実装

**src/hooks/usePredictions.ts**:
```typescript
import { useQuery } from '@tanstack/react-query';
import { HuggingFaceClient } from '@/lib/ml/hugging-face-client';
import { useDuckDB } from './useDuckDB';

export function usePredictions(userId: string) {
  const { query } = useDuckDB();
  const mlClient = new HuggingFaceClient(process.env.NEXT_PUBLIC_HF_API_KEY!);
  
  return useQuery({
    queryKey: ['predictions', userId],
    queryFn: async () => {
      // 過去のデータを取得
      const historicalData = await query(`
        SELECT 
          date,
          total_sleep_hours,
          sleep_efficiency,
          steps,
          heart_rate_variability,
          temperature_avg,
          humidity_avg,
          EXTRACT(DOW FROM date) as day_of_week,
          productivity_score,
          LAG(productivity_score) OVER (ORDER BY date) as prev_productivity
        FROM wellness_correlation
        WHERE user_id = ?
        ORDER BY date DESC
        LIMIT 30
      `, [userId]);
      
      // 明日の予測
      const latestData = historicalData[0];
      const tomorrowPrediction = await mlClient.predictProductivity({
        sleepHours: latestData.total_sleep_hours,
        sleepQuality: latestData.sleep_efficiency,
        steps: latestData.steps,
        heartRateVariability: latestData.heart_rate_variability || 40,
        temperature: latestData.temperature_avg,
        humidity: latestData.humidity_avg,
        dayOfWeek: (latestData.day_of_week + 1) % 7,
        previousDayProductivity: latestData.productivity_score
      });
      
      // 異常検知
      const productivitySeries = historicalData.map(d => d.productivity_score);
      const anomalies = await mlClient.detectAnomalies(productivitySeries);
      
      // インサイト生成
      const correlations = await query(`
        SELECT 
          sleep_productivity_corr,
          activity_productivity_corr,
          temp_productivity_corr
        FROM wellness_correlation
        WHERE user_id = ?
      `, [userId]);
      
      const insights = await mlClient.generateInsights({
        correlations: correlations[0],
        trends: calculateTrends(historicalData),
        anomalies: anomalies.isAnomaly
          .map((isAnom, i) => isAnom ? historicalData[i].date : null)
          .filter(Boolean) as string[]
      });
      
      return {
        tomorrowPrediction,
        anomalies,
        insights,
        historicalData
      };
    },
    staleTime: 1000 * 60 * 60, // 1時間
  });
}

function calculateTrends(data: any[]): Record<string, number> {
  // 簡単な線形回帰で傾向を計算
  const n = data.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const y = data.map(d => d.productivity_score);
  
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
  const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  
  return {
    productivity_trend: slope,
    direction: slope > 0 ? 1 : -1,
    strength: Math.abs(slope)
  };
}
```

## Week 12: ダッシュボード開発

### インタラクティブダッシュボード

**src/app/analytics/dashboard/page.tsx**:
```tsx
'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CorrelationHeatmap } from '@/components/analytics/correlation-heatmap';
import { ProductivityTrend } from '@/components/analytics/productivity-trend';
import { PredictionCard } from '@/components/analytics/prediction-card';
import { InsightsPanel } from '@/components/analytics/insights-panel';
import { useCorrelations } from '@/hooks/useCorrelations';
import { usePredictions } from '@/hooks/usePredictions';
import { RefreshCw, TrendingUp, Brain, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AnalyticsDashboard() {
  const [userId] = useState('current-user');
  const [refreshing, setRefreshing] = useState(false);
  
  const { data: correlations, refetch: refetchCorrelations } = useCorrelations(userId);
  const { data: predictions, refetch: refetchPredictions } = usePredictions(userId);
  
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetchCorrelations(),
      refetchPredictions()
    ]);
    setRefreshing(false);
  };
  
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">分析ダッシュボード</h1>
        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          size="sm"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          データ更新
        </Button>
      </div>
      
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">明日の予測</h3>
          </div>
          <PredictionCard prediction={predictions?.tomorrowPrediction} />
        </Card>
        
        <Card className="border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">AIインサイト</h3>
          </div>
          <InsightsPanel insights={predictions?.insights} />
        </Card>
        
        <Card className="border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">統計サマリー</h3>
          </div>
          <StatsSummary correlations={correlations} />
        </Card>
      </div>
      
      <Tabs defaultValue="trends" className="flex-1">
        <TabsList>
          <TabsTrigger value="trends">トレンド分析</TabsTrigger>
          <TabsTrigger value="correlations">相関分析</TabsTrigger>
          <TabsTrigger value="anomalies">異常検知</TabsTrigger>
          <TabsTrigger value="forecast">予測</TabsTrigger>
        </TabsList>
        
        <TabsContent value="trends" className="flex-1">
          <Card className="border border-border p-6">
            <ProductivityTrend data={predictions?.historicalData} />
          </Card>
        </TabsContent>
        
        <TabsContent value="correlations" className="flex-1">
          <Card className="border border-border p-6">
            <CorrelationHeatmap data={correlations} />
          </Card>
        </TabsContent>
        
        <TabsContent value="anomalies" className="flex-1">
          <Card className="border border-border p-6">
            <AnomalyDetection anomalies={predictions?.anomalies} />
          </Card>
        </TabsContent>
        
        <TabsContent value="forecast" className="flex-1">
          <Card className="border border-border p-6">
            <ForecastChart predictions={predictions} />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### 可視化コンポーネント

**src/components/analytics/correlation-heatmap.tsx**:
```tsx
import { useMemo } from 'react';
import { ResponsiveHeatMap } from '@nivo/heatmap';

interface CorrelationHeatmapProps {
  data: any;
}

export function CorrelationHeatmap({ data }: CorrelationHeatmapProps) {
  const heatmapData = useMemo(() => {
    if (!data) return [];
    
    const factors = [
      { id: '睡眠', key: 'sleep' },
      { id: '活動', key: 'activity' },
      { id: '環境', key: 'environment' },
      { id: '回復', key: 'recovery' }
    ];
    
    return factors.map(factor => ({
      id: factor.id,
      data: factors.map(target => ({
        x: target.id,
        y: data[`${factor.key}_${target.key}_corr`] || 0
      }))
    }));
  }, [data]);
  
  return (
    <div className="h-[400px]">
      <ResponsiveHeatMap
        data={heatmapData}
        margin={{ top: 60, right: 90, bottom: 60, left: 90 }}
        valueFormat=">-.2f"
        axisTop={{
          tickSize: 5,
          tickPadding: 5,
          tickRotation: -45,
          legend: '',
          legendOffset: 46
        }}
        axisRight={null}
        axisBottom={{
          tickSize: 5,
          tickPadding: 5,
          tickRotation: -45,
          legend: '要因',
          legendPosition: 'middle',
          legendOffset: 36
        }}
        axisLeft={{
          tickSize: 5,
          tickPadding: 5,
          tickRotation: 0,
          legend: '要因',
          legendPosition: 'middle',
          legendOffset: -40
        }}
        colors={{
          type: 'diverging',
          scheme: 'red_yellow_blue',
          divergeAt: 0.5,
          minValue: -1,
          maxValue: 1
        }}
        emptyColor="#555555"
        borderColor={{
          from: 'color',
          modifiers: [['darker', 0.6]]
        }}
        labelTextColor={{
          from: 'color',
          modifiers: [['darker', 2]]
        }}
        legends={[
          {
            anchor: 'bottom',
            translateX: 0,
            translateY: 30,
            length: 400,
            thickness: 8,
            direction: 'row',
            tickPosition: 'after',
            tickSize: 3,
            tickSpacing: 4,
            tickOverlap: false,
            title: '相関係数',
            titleAlign: 'start',
            titleOffset: 4
          }
        ]}
      />
    </div>
  );
}
```

## 成果物チェックリスト

### Week 9-10 完了基準
- [ ] 相関分析モデル実装
- [ ] 統計関数ライブラリ作成
- [ ] 相関可視化コンポーネント完成

### Week 11 完了基準
- [ ] Hugging Face API統合
- [ ] 予測モデル実装
- [ ] 異常検知機能実装
- [ ] AIインサイト生成

### Week 12 完了基準
- [ ] ダッシュボード画面完成
- [ ] 全可視化コンポーネント実装
- [ ] リアルタイム更新機能
- [ ] パフォーマンス最適化完了

---

*最終更新: 2024年2月*
*Phase 4 リード: MLエンジニアリングチーム*