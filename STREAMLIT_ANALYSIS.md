# Streamlit App Analysis: Migration to Dimensional Model

## Executive Summary

The Streamlit application currently references old dbt staging models and intermediate models. A new dimensional modeling structure has been implemented with:
- **Dimensional Tables**: dim_date, dim_time, dim_user
- **Fact Tables**: fact_work_sessions
- **Updated Intermediate Models**: int_daily_health_summary, int_productivity_metrics
- **Updated Mart Models**: mart_productivity_daily, mart_wellness_correlation

## Current Streamlit Architecture

### Files to Update:
1. `/Users/junya/Dev/moderation-craft/streamlit/app.py` - Main viewer
2. `/Users/junya/Dev/moderation-craft/streamlit/utils/database.py` - Database utilities
3. `/Users/junya/Dev/moderation-craft/streamlit/utils/mock_data.py` - Mock data generation
4. `/Users/junya/Dev/moderation-craft/streamlit/pages/1_📊_Productivity.py` - Productivity analysis
5. `/Users/junya/Dev/moderation-craft/streamlit/pages/2_💤_Health.py` - Health correlation analysis
6. `/Users/junya/Dev/moderation-craft/streamlit/pages/3_🔍_Explorer.py` - Data explorer

## Detailed Analysis

### 1. CURRENT TABLE/COLUMN REFERENCES

#### app.py References:
```
main.stg_fitbit_sleep_json
main.stg_fitbit_activity_json
main_staging.stg_fitbit_sleep_json
main_staging.stg_fitbit_activity_json
main_staging.stg_work_sessions
  - time_slot
  - day_of_week
  - session_date
  - duration_minutes
main_intermediate.int_daily_health_summary
main_intermediate.int_productivity_metrics
main_gold.mart_wellness_correlation
main_gold.mart_productivity_daily
```

#### Productivity Page (1_📊_Productivity.py) SQL Queries:
Line 72-85 - Query from `main_gold.mart_productivity_daily`:
```sql
SELECT 
    {date_format} as period,
    AVG(productivity_score) as productivity_score,
    AVG(work_hours) as work_hours,
    AVG(work_sessions) as work_sessions,
    AVG(pomodoro_rate) as pomodoro_rate,
    AVG(mood_level) as mood_level,
    COUNT(*) as data_points
FROM main_gold.mart_productivity_daily
```

**Referenced Columns**: 
- date, productivity_score, work_hours, work_sessions, pomodoro_rate, mood_level

#### Health Page (2_💤_Health.py) SQL Queries:
Line 60-75 - Query from `main_gold.mart_wellness_correlation`:
```sql
SELECT 
    date,
    productivity_score,
    health_score,
    sleep_score,
    sleep_hours,
    work_hours,
    mood_level,
    steps,
    correlation_pattern,
    sleep_7d_avg,
    productivity_7d_avg
FROM main_gold.mart_wellness_correlation
```

**Referenced Columns**:
- date, productivity_score, health_score, sleep_score, sleep_hours, work_hours
- mood_level, steps, correlation_pattern, sleep_7d_avg, productivity_7d_avg

#### Explorer Page (3_🔍_Explorer.py):
- Line 56: Sample query references `mart_productivity_daily` without schema
- Line 82: References undefined `sleep_hours` column in mart_productivity_daily
- Line 106: Uses deprecated column names
- Line 268: Calls `get_table_schema()` function that doesn't exist in database.py
- Line 34: Calls `get_available_tables()` without conn parameter

### 2. DATABASE CONNECTION SETUP

**File**: `/Users/junya/Dev/moderation-craft/streamlit/utils/database.py`

Current Implementation:
```python
def get_connection():
    duckdb_path = current_dir.parent / "dbt" / "moderation_craft_dev.duckdb"
    if duckdb_path.exists():
        conn = duckdb.connect(str(duckdb_path), read_only=True)
        return conn
    else:
        return duckdb.connect(":memory:")
```

**Issues**:
1. Database file path is hard-coded
2. No error handling for corrupted database
3. `get_available_tables()` has inconsistent parameter passing in pages

### 3. MAPPING: OLD → NEW TABLE/COLUMN REFERENCES

#### Old stg_work_sessions → New fact_work_sessions + dim_date + dim_time

| Old Column | Location | New Location | Notes |
|-----------|----------|--------------|-------|
| time_slot | stg_work_sessions (L77-85) | dim_time.time_slot | Moved to dimension |
| day_of_week | Calculated | dim_date.day_of_week, fact_work_sessions.day_of_week | De-normalized in fact |
| session_date | stg_work_sessions | fact_work_sessions.date_key → dim_date.date | FK reference |
| duration_minutes | stg_work_sessions | fact_work_sessions.duration_minutes | Direct copy |
| duration_seconds | stg_work_sessions | fact_work_sessions.duration_seconds | Direct copy |
| mood_rating | stg_work_sessions | fact_work_sessions.mood_rating | Direct copy |
| dopamine_level | stg_work_sessions | fact_work_sessions.dopamine_level | Direct copy |
| productivity_score | Calculated (L89-94) | fact_work_sessions.productivity_score | Recalculated in fact |

#### Old mart_productivity_daily → New mart_productivity_daily

| Old Column | New Column | Change | Notes |
|-----------|-----------|--------|-------|
| N/A | sleep_score | **ADDED** | From health data |
| N/A | activity_score | **ADDED** | From health data |
| N/A | health_score | **ADDED** | Alias for overall_health_score |
| N/A | total_sleep_hours | **ADDED** | From health data |
| N/A | sleep_quality_category | **ADDED** | From health data |
| N/A | steps | **ADDED** | From health data |
| N/A | activity_level | **ADDED** | From health data |
| work_sessions | work_sessions | **RENAMED** | From total_sessions |
| work_hours | work_hours | **RENAMED** | From total_work_hours |
| sleep_hours | **REMOVED** | ❌ **Column doesn't exist in new model** | Use total_sleep_hours instead |
| mood_level | mood_level | **UNCHANGED** | From int_productivity_metrics.avg_mood |
| dopamine_level | dopamine_level | **UNCHANGED** | From int_productivity_metrics.avg_dopamine |
| focus_score | focus_score | **UNCHANGED** | New calculated field |
| most_productive_time_slot | most_productive_time_slot | **UNCHANGED** | From int_productivity_metrics |
| performance_category | performance_category | **ADDED** | Classification logic |
| data_completeness | data_completeness | **ADDED** | Data quality indicator |

#### Old mart_wellness_correlation → New mart_wellness_correlation

| Old Column | New Column | Change | Notes |
|-----------|-----------|--------|-------|
| sleep_score | sleep_score | **UNCHANGED** | Direct copy |
| productivity_score | productivity_score | **UNCHANGED** | Direct copy |
| health_score | health_score | **UNCHANGED** | Direct copy |
| sleep_hours | **REMOVED** | ❌ **Column doesn't exist** | Use separate health table or total_sleep_hours |
| work_hours | **REMOVED** | ❌ **Column doesn't exist** | Reference from mart_productivity_daily or int_productivity_metrics |
| mood_level | mood_level | **UNCHANGED** | Direct copy |
| sleep_7d_avg | sleep_7d_avg | **UNCHANGED** | Sleep score 7-day average |
| productivity_7d_avg | productivity_7d_avg | **UNCHANGED** | Productivity score 7-day average |
| correlation_pattern | correlation_pattern | **ADDED** | e.g., 'both_improving', 'both_declining' |
| sleep_impact_on_productivity | sleep_impact_on_productivity | **ADDED** | New field |
| weekly_performance | weekly_performance | **ADDED** | e.g., 'excellent_week', 'good_week' |
| significant_change | significant_change | **ADDED** | Boolean flag |
| needs_intervention | needs_intervention | **ADDED** | Boolean flag |

### 4. DATABASE UTILITY FUNCTIONS

**Missing Functions** in `database.py`:
```python
def get_table_schema(table_name: str) -> pd.DataFrame:
    """Get schema information for a table"""
    # Used in Explorer page line 268
    
def setup_mock_database(conn) -> list:
    """Create mock data in database"""
    # Used in pages 1, 2, 3
    # Currently in mock_data.py but needs to return table list
```

### 5. ALL FILES REQUIRING UPDATES

#### Critical Updates (Breaking Changes):
1. ✅ **app.py** (Lines 34-44)
   - Update model_descriptions dict to reference new models/schemas
   
2. �� **pages/1_📊_Productivity.py** (Lines 72-85)
   - Query references `work_sessions` column (should be `work_sessions` - exists)
   - All other columns exist in new model
   
3. ✅ **pages/2_💤_Health.py** (Lines 60-75)
   - Column `sleep_hours` referenced but doesn't exist in new model
   - Need to JOIN with additional data or use alternative

4. ✅ **pages/3_🔍_Explorer.py** (Multiple lines)
   - Line 34: `get_available_tables()` called without conn parameter
   - Line 56: Sample query doesn't reference schema
   - Line 82: References `sleep_hours` column
   - Line 106: Sample query missing schema prefix
   - Line 268: Calls undefined `get_table_schema()` function

#### Moderate Updates (API Changes):
5. ✅ **utils/database.py**
   - Add `get_table_schema()` function
   - Fix `get_available_tables()` parameter handling

6. ✅ **utils/mock_data.py**
   - Add `setup_mock_database()` function
   - Update mock data generation for new schema
   - Match new column names (no `sleep_hours`, use `total_sleep_hours`)

## SQL QUERY UPDATES NEEDED

### Productivity Page - Update Required:
```sql
-- BEFORE:
SELECT 
    {date_format} as period,
    AVG(productivity_score) as productivity_score,
    AVG(work_hours) as work_hours,
    AVG(work_sessions) as work_sessions,
    AVG(pomodoro_rate) as pomodoro_rate,
    AVG(mood_level) as mood_level,
    COUNT(*) as data_points
FROM main_gold.mart_productivity_daily

-- AFTER (NO CHANGE NEEDED):
-- All columns exist in new model with same names
-- Model name stayed the same: main_gold.mart_productivity_daily
```

### Health Page - Update REQUIRED:
```sql
-- BEFORE:
SELECT 
    date,
    productivity_score,
    health_score,
    sleep_score,
    sleep_hours,  -- ❌ COLUMN DOESN'T EXIST
    work_hours,   -- ❌ COLUMN DOESN'T EXIST
    ...
FROM main_gold.mart_wellness_correlation

-- AFTER (JOIN REQUIRED):
SELECT 
    c.date,
    c.productivity_score,
    c.health_score,
    c.sleep_score,
    p.total_sleep_hours AS sleep_hours,  -- FROM mart_productivity_daily
    p.work_hours,  -- FROM mart_productivity_daily
    ...
FROM main_gold.mart_wellness_correlation c
LEFT JOIN main_gold.mart_productivity_daily p
    ON c.user_id = p.user_id AND c.date = p.date
```

### Explorer Page - Updates Required:
```sql
-- Sample queries need schema prefixes:
-- FROM mart_productivity_daily → FROM main_gold.mart_productivity_daily
-- FROM mart_wellness_correlation → FROM main_gold.mart_wellness_correlation
```

## COLUMN COMPATIBILITY MATRIX

### Health Page (2_💤_Health.py) - Required Columns Analysis

```
Query Line 60-75 requirements:
✅ date - EXISTS in both models
✅ productivity_score - EXISTS in mart_wellness_correlation
✅ health_score - EXISTS in mart_productivity_daily
✅ sleep_score - EXISTS in mart_wellness_correlation
❌ sleep_hours - MISSING in mart_wellness_correlation
❌ work_hours - MISSING in mart_wellness_correlation (exists in mart_productivity_daily)
✅ mood_level - EXISTS in mart_wellness_correlation
✅ steps - EXISTS in mart_productivity_daily
✅ correlation_pattern - EXISTS in mart_wellness_correlation
✅ sleep_7d_avg - EXISTS in mart_wellness_correlation
✅ productivity_7d_avg - EXISTS in mart_wellness_correlation

SOLUTION: LEFT JOIN mart_productivity_daily to get sleep_hours and work_hours
```

## POTENTIAL BREAKING CHANGES & ISSUES

1. **Column Mismatches in Health Page**:
   - sleep_hours doesn't exist in mart_wellness_correlation
   - work_hours doesn't exist in mart_wellness_correlation
   - Need to join with mart_productivity_daily

2. **Missing Functions**:
   - `get_table_schema()` called but not defined
   - `setup_mock_database()` called but may not exist in mock_data.py

3. **Parameter Consistency**:
   - `get_available_tables(conn)` defined with conn parameter
   - Called without conn parameter in Explorer page (line 34)

4. **Mock Data Generation**:
   - Current mock_data.py may not generate all required columns
   - Needs to generate fact_work_sessions and dimension data

5. **Schema Prefixes**:
   - Some queries missing schema prefixes (main_gold., etc.)
   - explorer page has hardcoded table references

## RECOMMENDED SQL QUERY UPDATES

### Priority 1: CRITICAL (Blocking Queries)

#### Health Page Query Update (Line 60-75):
```python
# Updated query with JOIN:
query = f"""
    SELECT 
        c.date,
        c.productivity_score,
        c.health_score,
        c.sleep_score,
        p.total_sleep_hours AS sleep_hours,
        p.work_hours,
        c.mood_level,
        p.steps,
        c.correlation_pattern,
        c.sleep_7d_avg,
        c.productivity_7d_avg
    FROM main_gold.mart_wellness_correlation c
    LEFT JOIN main_gold.mart_productivity_daily p
        ON c.user_id = p.user_id AND c.date = p.date
    WHERE c.date >= CURRENT_DATE - INTERVAL '{days} days'
    ORDER BY c.date DESC
"""
```

### Priority 2: IMPORTANT (Function/Import Issues)

#### Explorer Page Fixes:
1. Line 34: Change `get_available_tables()` → `get_available_tables(conn)`
2. Lines 56, 82, 106: Add schema prefix to table names
3. Line 268: Add `get_table_schema()` function to database.py

#### Database Utils Additions:
```python
def get_table_schema(table_name: str, conn=None) -> pd.DataFrame:
    """Get column information for a table"""
    if conn is None:
        conn = get_connection()
    
    query = f"""
        SELECT
            column_name,
            data_type,
            is_nullable
        FROM information_schema.columns
        WHERE table_name = '{table_name}'
        ORDER BY ordinal_position
    """
    return run_query(query, conn)
```

### Priority 3: NICE-TO-HAVE (Optimization)

1. Add table metadata to app.py viewer
2. Update sample queries in Explorer with schema prefixes
3. Add documentation comments referencing new dimensional model

## IMPLEMENTATION CHECKLIST

### Phase 1: Fix Critical Blocking Issues
- [ ] Add `get_table_schema()` to database.py
- [ ] Fix parameter passing in pages (add conn parameter)
- [ ] Update Health page query to use JOIN (or create view)
- [ ] Test mock_data generation for new columns

### Phase 2: Update Documentation & UI
- [ ] Update model_descriptions in app.py
- [ ] Add dimension table viewers to app.py
- [ ] Update sample queries in Explorer page
- [ ] Add comments documenting changes

### Phase 3: Testing & Validation
- [ ] Run quality checks: `npm run quality`
- [ ] Verify all Streamlit pages load without errors
- [ ] Check data continuity: compare old vs new values
- [ ] Validate query results match expectations

## FILES REQUIRING CHANGES - SUMMARY

| File | Changes | Priority | Lines |
|------|---------|----------|-------|
| utils/database.py | Add `get_table_schema()` | CRITICAL | +15 |
| utils/mock_data.py | Update mock generation | HIGH | ~50 |
| app.py | Update model references | HIGH | 32-45 |
| pages/1_📊_Productivity.py | Verify column names | LOW | 72-85 |
| pages/2_💤_Health.py | **JOIN for sleep_hours** | **CRITICAL** | 60-75 |
| pages/3_🔍_Explorer.py | Fix function calls, schema prefixes | MEDIUM | 34, 56, 82, 106, 268 |

## BACKWARD COMPATIBILITY

- New dimensional model maintains same Mart output column names
- Staging/Intermediate tables have different names but same data
- Breaking change: mart_wellness_correlation missing sleep_hours/work_hours columns
- Solution: Use JOIN pattern or create view for backward compatibility

---

Generated: 2025-11-02
Analysis Scope: Complete Streamlit application alignment with dimensional model
