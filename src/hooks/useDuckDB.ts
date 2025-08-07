import { useEffect, useState, useCallback, useRef } from 'react';
import { DuckDBClient } from '@/lib/analytics/duckdb-client';

export interface DuckDBHookResult {
  query: (sql: string, params?: any[]) => Promise<any[]>;
  getProductivityDaily: (userId: string, days?: number) => Promise<any[]>;
  getWellnessCorrelation: (userId: string, days?: number) => Promise<any[]>;
  getPerformanceSummary: (userId: string) => Promise<any>;
  loading: boolean;
  error: Error | null;
  isInitialized: boolean;
}

export function useDuckDB(): DuckDBHookResult {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const clientRef = useRef<DuckDBClient | null>(null);
  
  useEffect(() => {
    let isMounted = true;
    
    const initializeClient = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const duckdbClient = new DuckDBClient();
        await duckdbClient.initialize();
        
        // データマートをビューとして登録
        try {
          await duckdbClient.loadDataMart('mart_productivity_daily');
          await duckdbClient.loadDataMart('mart_wellness_correlation');
        } catch (e) {
          console.warn('Failed to load data marts from S3:', e);
          // S3からのロードが失敗してもクライアントは使用可能
        }
        
        if (isMounted) {
          clientRef.current = duckdbClient;
          setIsInitialized(true);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err as Error);
          setLoading(false);
        }
      }
    };
    
    initializeClient();
    
    return () => {
      isMounted = false;
      if (clientRef.current) {
        clientRef.current.close().catch(console.error);
      }
    };
  }, []);
  
  const query = useCallback(async (sql: string, params?: any[]) => {
    if (!clientRef.current) {
      throw new Error('DuckDB client not initialized');
    }
    return clientRef.current.query(sql, params);
  }, []);
  
  const getProductivityDaily = useCallback(async (userId: string, days: number = 30) => {
    if (!clientRef.current) {
      throw new Error('DuckDB client not initialized');
    }
    return clientRef.current.getProductivityDaily(userId, days);
  }, []);
  
  const getWellnessCorrelation = useCallback(async (userId: string, days: number = 30) => {
    if (!clientRef.current) {
      throw new Error('DuckDB client not initialized');
    }
    return clientRef.current.getWellnessCorrelation(userId, days);
  }, []);
  
  const getPerformanceSummary = useCallback(async (userId: string) => {
    if (!clientRef.current) {
      throw new Error('DuckDB client not initialized');
    }
    return clientRef.current.getPerformanceSummary(userId);
  }, []);
  
  return { 
    query, 
    getProductivityDaily,
    getWellnessCorrelation,
    getPerformanceSummary,
    loading, 
    error,
    isInitialized
  };
}