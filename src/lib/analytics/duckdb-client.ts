import * as duckdb from '@duckdb/duckdb-wasm';

export class DuckDBClient {
  private db: duckdb.AsyncDuckDB | null = null;
  private conn: duckdb.AsyncDuckDBConnection | null = null;
  
  async initialize() {
    try {
      // Use local bundles to avoid CORS issues
      const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
        mvp: {
          mainModule: '/duckdb-wasm/duckdb-mvp.wasm',
          mainWorker: '/duckdb-wasm/duckdb-browser-mvp.worker.js',
        },
        eh: {
          mainModule: '/duckdb-wasm/duckdb-eh.wasm',
          mainWorker: '/duckdb-wasm/duckdb-browser-eh.worker.js',
        },
      };
      
      // Select bundle based on browser support
      const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
      
      const worker = new Worker(bundle.mainWorker!);
      const logger = new duckdb.ConsoleLogger();
      this.db = new duckdb.AsyncDuckDB(logger, worker);
      
      await this.db.instantiate(bundle.mainModule, bundle.pthreadWorker);
      this.conn = await this.db.connect();
    } catch (error) {
      console.error('Failed to initialize DuckDB:', error);
      throw new Error('DuckDB initialization failed. Please check browser compatibility.');
    }
    
    // S3設定
    await this.configureS3();
    
    // 拡張機能のロード
    await this.loadExtensions();
  }
  
  private async configureS3() {
    if (!this.conn) throw new Error('Database not initialized');
    
    try {
      // S3アクセス設定（HTTPFSが必要）
      const accessKeyId = process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID;
      const secretAccessKey = process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY;
      
      if (accessKeyId && secretAccessKey) {
        await this.conn.query(`
          SET s3_region='ap-northeast-1';
          SET s3_access_key_id='${accessKeyId}';
          SET s3_secret_access_key='${secretAccessKey}';
        `);
        // S3 configuration applied
      } else {
        console.warn('AWS credentials not found - S3 access disabled');
      }
    } catch (e) {
      console.warn('Failed to configure S3 access:', e);
      // S3設定が失敗してもローカルクエリは実行可能
    }
  }
  
  private async loadExtensions() {
    if (!this.conn) throw new Error('Database not initialized');
    
    // 拡張機能のロード（エラーを個別に処理）
    try {
      // Parquet拡張（基本的に組み込み済み）
      await this.conn.query(`LOAD parquet;`);
      // Parquet extension loaded
    } catch (e) {
      console.warn('Parquet extension load failed (may be built-in):', e);
    }
    
    try {
      // HTTPFS拡張（S3アクセス用）
      // WASM環境では利用できない場合がある
      await this.conn.query(`INSTALL httpfs;`);
      await this.conn.query(`LOAD httpfs;`);
      // HTTPFS extension loaded - S3 access enabled
    } catch (e) {
      console.warn('HTTPFS extension not available - S3 access disabled:', e);
      // S3アクセスは利用できないが、ローカルクエリは実行可能
    }
  }
  
  async query(sql: string, params?: any[]): Promise<any[]> {
    if (!this.conn) throw new Error('Database not initialized');
    
    // DuckDB WASM query method only accepts SQL string, not params
    const result = await this.conn.query(sql);
    
    return result.toArray().map((row) => row.toJSON());
  }
  
  async createView(name: string, query: string) {
    if (!this.conn) throw new Error('Database not initialized');
    
    await this.conn.query(`
      CREATE OR REPLACE VIEW ${name} AS ${query}
    `);
  }
  
  async loadParquetFromS3(viewName: string, s3Path: string) {
    await this.createView(viewName, `
      SELECT * FROM read_parquet('${s3Path}')
    `);
  }
  
  async loadDataMart(name: string) {
    const s3Bucket = 's3://moderation-craft-data-800860245583';
    const martPath = `${s3Bucket}/gold/${name}/*.parquet`;
    await this.loadParquetFromS3(name, martPath);
  }
  
  async close() {
    if (this.conn) {
      await this.conn.close();
    }
    if (this.db) {
      await this.db.terminate();
    }
  }
  
  // 便利なクエリメソッド
  async getProductivityDaily(userId: string, days: number = 30): Promise<any[]> {
    const sql = `
      SELECT 
        date,
        productivity_score,
        health_score,
        work_hours,
        sleep_score,
        wellness_productivity_index,
        performance_category
      FROM productivity_daily
      WHERE user_id = ?
        AND date >= CURRENT_DATE - INTERVAL '${days} days'
      ORDER BY date DESC
    `;
    return this.query(sql, [userId]);
  }
  
  async getWellnessCorrelation(userId: string, days: number = 30): Promise<any[]> {
    const sql = `
      SELECT 
        date,
        sleep_score,
        productivity_score,
        correlation_pattern,
        sleep_impact_on_productivity,
        sleep_7d_avg,
        productivity_7d_avg,
        significant_change,
        needs_intervention
      FROM wellness_correlation
      WHERE user_id = ?
        AND date >= CURRENT_DATE - INTERVAL '${days} days'
      ORDER BY date DESC
    `;
    return this.query(sql, [userId]);
  }
  
  async getPerformanceSummary(userId: string): Promise<any> {
    const sql = `
      WITH recent_data AS (
        SELECT 
          AVG(productivity_score) as avg_productivity,
          AVG(health_score) as avg_health,
          AVG(wellness_productivity_index) as avg_wellness_index,
          MODE() WITHIN GROUP (ORDER BY performance_category) as typical_performance,
          COUNT(*) as days_tracked
        FROM productivity_daily
        WHERE user_id = ?
          AND date >= CURRENT_DATE - INTERVAL '30 days'
      ),
      trends AS (
        SELECT 
          AVG(CASE WHEN date >= CURRENT_DATE - INTERVAL '7 days' THEN productivity_score END) -
          AVG(CASE WHEN date < CURRENT_DATE - INTERVAL '7 days' THEN productivity_score END) as productivity_trend,
          AVG(CASE WHEN date >= CURRENT_DATE - INTERVAL '7 days' THEN health_score END) -
          AVG(CASE WHEN date < CURRENT_DATE - INTERVAL '7 days' THEN health_score END) as health_trend
        FROM productivity_daily
        WHERE user_id = ?
          AND date >= CURRENT_DATE - INTERVAL '14 days'
      )
      SELECT 
        r.*,
        t.productivity_trend,
        t.health_trend
      FROM recent_data r
      CROSS JOIN trends t
    `;
    const result = await this.query(sql, [userId, userId]);
    return result[0];
  }
}