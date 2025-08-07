  {{ config(
      materialized='view'
  ) }}

  -- これは最初のテストモデルです
  -- DuckDBの動作確認用にシンプルなデータを生成します

  WITH test_data AS (
      SELECT
          1 AS id,
          'user_001' AS user_id,
          '2024-08-01'::DATE AS date,
          100 AS value,
          'test' AS category
      UNION ALL
      SELECT
          2 AS id,
          'user_002' AS user_id,
          '2024-08-02'::DATE AS date,
          200 AS value,
          'test' AS category
      UNION ALL
      SELECT
          3 AS id,
          'user_003' AS user_id,
          '2024-08-03'::DATE AS date,
          150 AS value,
          'demo' AS category
  )

  SELECT * FROM test_data
