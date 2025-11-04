# Streamlit App Analysis: Alignment with New dbt Dimensional Modeling

## Executive Summary

The Streamlit app currently references **7 dbt models** across 4 layers (staging, intermediate, marts). After analyzing the new dimensional modeling structure, I've identified that the Streamlit app needs significant updates to align with the new fact/dimension tables and their column changes.

**Key Finding**: The app is using generic mart tables that need to be refactored to reference new fact tables (`fact_work_sessions`) and dimension tables (`dim_date`, `dim_time`, `dim_user`).

---

## 1. Database Connection Setup

**File**: `/Users/junya/Dev/moderation-craft/streamlit/utils/database.py`

### Current Implementation
```python
duckdb_path = current_dir.parent / "dbt" / "moderation_craft_dev.duckdb"
conn = duckdb.connect(str(duckdb_path), read_only=True)
```

**Status**: ✅ READY - Correctly points to dbt output database
- Reads from: `/Users/junya/Dev/moderation-craft/dbt/moderation_craft_dev.duckdb`
- Read-only mode: Good for analytics
- Fallback to in-memory DB: Acceptable for development

### Issues Found
- ❌ Missing `get_table_schema()` function (referenced in `pages/3_🔍_Explorer.py`)
- ❌ Missing `setup_mock_database()` function (referenced in multiple pages)

---

## 2. Current SQL Queries in Streamlit

### app.py (Main Dashboard - dbt Models Viewer)
**Status**: ✅ Minimal queries - Only uses LIMIT, COUNT, and table selection
```sql
SELECT * FROM {table_name} LIMIT 100
SELECT COUNT(*) as total FROM {table_name}
```
**No breaking changes expected here** - This is generic and works with any table structure.

---

### pages/1_📊_Productivity.py (Productivity Analysis)

#### Query 1: Load Productivity Data (Lines 72-85)
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
WHERE date >= CURRENT_DATE - INTERVAL '{days} days'
GROUP BY {group_by}
ORDER BY period DESC
```

**Current Table**: `main_gold.mart_productivity_daily`
**Columns Used**:
- `date` ✅ Still exists
- `productivity_score` ✅ Still exists
- `work_hours` ✅ Still exists
- `work_sessions` ✅ Still exists (renamed from `total_sessions`)
- `pomodoro_rate` ✅ Still exists
- `mood_level` ✅ Still exists

**Status**: ✅ COMPATIBLE - All columns exist in new structure

#### Hard-coded Data (Lines 197-198)
Mock data used for time slot analysis - not from dbt, safe to ignore.

---

### pages/2_💤_Health.py (Health Correlation Analysis)

#### Query 1: Load Correlation Data (Lines 60-76)
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
WHERE date >= CURRENT_DATE - INTERVAL '{days} days'
ORDER BY date DESC
```

**Current Table**: `main_gold.mart_wellness_correlation`
**Columns Used**:
- `date` ✅ Still exists
- `productivity_score` ✅ Still exists
- `health_score` ✅ Still exists
- `sleep_score` ✅ Still exists
- `sleep_hours` ⚠️ MISSING - No longer in mart_wellness_correlation (was in mart_productivity_daily)
- `work_hours` ⚠️ MISSING - No longer in mart_wellness_correlation
- `mood_level` ✅ Still exists
- `steps` ⚠️ MISSING - No longer in mart_wellness_correlation (was in mart_productivity_daily)
- `correlation_pattern` ✅ Still exists
- `sleep_7d_avg` ✅ Still exists
- `productivity_7d_avg` ✅ Still exists

**Status**: ⚠️ NEEDS UPDATE - Missing 3 columns

#### Query 2: Simple Query (Lines 87-92) - Fallback
```sql
SELECT * FROM main_gold.mart_wellness_correlation
WHERE date >= CURRENT_DATE - INTERVAL '{days} days'
ORDER BY date DESC
```
**Status**: ✅ SAFE - Uses SELECT *

---

### pages/3_🔍_Explorer.py (Data Explorer)

#### Default Query (Line 106)
```sql
SELECT * FROM mart_productivity_daily LIMIT 10
```
**Status**: ✅ Safe - Generic, uses SELECT *

#### Sample Query 1: Daily Aggregation
```sql
SELECT 
    DATE_TRUNC('day', date) as day,
    AVG(productivity_score) as avg_productivity,
    AVG(health_score) as avg_health
FROM mart_productivity_daily
GROUP BY day
ORDER BY day DESC
```
**Status**: ✅ COMPATIBLE - All columns exist

#### Sample Query 2: Correlation Analysis
```sql
SELECT 
    CORR(sleep_score, productivity_score) as sleep_correlation,
    CORR(health_score, productivity_score) as health_correlation,
    CORR(work_hours, productivity_score) as work_correlation
FROM mart_productivity_daily
```
**Status**: ✅ COMPATIBLE - All columns exist

#### Sample Query 3: Weekly Performance
```sql
SELECT 
    EXTRACT(DOW FROM date) as day_of_week,
    AVG(productivity_score) as avg_productivity,
    COUNT(*) as data_points
FROM mart_productivity_daily
GROUP BY day_of_week
ORDER BY day_of_week
```
**Status**: ✅ COMPATIBLE - All columns exist

#### Sample Query 4: Top 10 Productive Days
```sql
SELECT 
    date,
    productivity_score,
    health_score,
    work_hours,
    sleep_hours
FROM mart_productivity_daily
ORDER BY productivity_score DESC
LIMIT 10
```
**Status**: ⚠️ NEEDS UPDATE - `sleep_hours` column name issue (check if it exists in new model)

---

## 3. Old vs. New Table/Column Mapping

### Staging Layer

#### stg_work_sessions
**Old Columns** → **New Columns**:
```
session_date         → (implicit via start_time)
time_slot            → MOVED TO dim_time.time_slot
day_of_week          → MOVED TO dim_date.day_of_week
...
```

### Dimensional Layer (NEW)

#### dim_date
**Purpose**: Date attributes, replaces inline calculations
**Key Columns**:
- `date_key` (YYYYMMDD format integer) - Surrogate key
- `date` - Actual date
- `day_of_week` - Was in stg_work_sessions
- `is_weekend` - Was in stg_work_sessions
- `is_business_day` - New calculated field
- `month`, `year`, `week_of_year`, `quarter`

#### dim_time
**Purpose**: Time attributes, NEW table
**Key Columns**:
- `time_key` (HHMM format integer) - Surrogate key
- `time_label` (HH:MM format)
- `time_slot` - Was in stg_work_sessions (early_morning, morning, late_morning, afternoon, late_afternoon, evening, night)
- `is_business_hours` - Was in stg_work_sessions
- `is_peak_hours` - NEW
- `is_late_night` - NEW

#### dim_user
**Purpose**: User dimension, SCD Type 2
**Key Columns**:
- `user_key` - Surrogate key
- `user_id` - Business key
- `effective_from`, `effective_to` - SCD Type 2 dates
- `is_current` - Current record flag

### Fact Layer (NEW)

#### fact_work_sessions
**Purpose**: Replaces session-level logic previously in stg_work_sessions
**Key Columns**:
```
session_id
date_key              → NEW (FK to dim_date)
time_key              → NEW (FK to dim_time)
user_key              → NEW (FK to dim_user)
project_id            → Still here
small_task_id         → Still here
start_time_jst        → NEW (JST converted)
duration_seconds      → Was duration_minutes, now in seconds
duration_minutes      → Calculated from duration_seconds
focus_level           → Still here
mood_rating           → Still here
dopamine_level        → Still here
productivity_score    → NEW (calculated: 100/80/60/40 based on duration)
day_of_week           → Denormalized from dim_date
is_weekend            → Denormalized from dim_date
time_slot             → Denormalized from dim_time
is_business_hours     → Denormalized from dim_time
```

### Mart Layer

#### mart_productivity_daily (UPDATED)
**Changes**:
- Still at day-level granularity ✅
- Column changes:
  - `total_sessions` → `work_sessions` ✅
  - All other columns remain compatible ✅

**Columns**:
- `date` ✅
- `sleep_score` ✅
- `activity_score` ✅
- `health_score` ✅
- `work_sessions` ✅
- `work_hours` ✅
- `pomodoro_rate` ✅
- `productivity_score` ✅
- `mood_level` ✅
- `dopamine_level` ✅
- `focus_score` ✅
- `most_productive_time_slot` ✅
- `wellness_productivity_index` ✅
- `performance_category` ✅
- `data_completeness` ✅

#### mart_wellness_correlation (STRUCTURE CHANGED)
**Critical Issue**: Now depends on mart_productivity_daily via JOIN
**Old columns lost**:
- ❌ `work_hours` (need to join with mart_productivity_daily)
- ❌ `sleep_hours` (need to join with mart_productivity_daily)
- ❌ `steps` (need to join with mart_productivity_daily)

**Still present**:
- ✅ `date`
- ✅ `sleep_score`
- ✅ `productivity_score`
- ✅ `mood_level`
- ✅ `correlation_pattern`
- ✅ `sleep_7d_avg`, `productivity_7d_avg`

---

## 4. Files Requiring Updates

### HIGH PRIORITY (Breaking Changes)

1. **`/Users/junya/Dev/moderation-craft/streamlit/pages/2_💤_Health.py`**
   - Lines 60-76: Update query to JOIN mart_wellness_correlation with mart_productivity_daily
   - Remove columns: `sleep_hours`, `work_hours`, `steps`
   - Add JOIN logic for missing columns

2. **`/Users/junya/Dev/moderation-craft/streamlit/utils/database.py`**
   - ADD: `get_table_schema()` function (referenced but not defined)
   - ADD: `setup_mock_database()` function (referenced but not defined)

### MEDIUM PRIORITY (Minor Updates)

3. **`/Users/junya/Dev/moderation-craft/streamlit/pages/3_🔍_Explorer.py`**
   - Lines 49-87: Sample query #4 references `sleep_hours` - verify this column exists in new mart_productivity_daily
   - Line 12: Fix import - `get_table_schema` must be implemented first

### LOW PRIORITY (Informational)

4. **`/Users/junya/Dev/moderation-craft/streamlit/utils/mock_data.py`**
   - Missing: `setup_mock_database()` function body
   - This is for development/testing only

5. **`/Users/junya/Dev/moderation-craft/streamlit/app.py`**
   - No changes needed - Generic queries work with new structure

---

## 5. Recommended SQL Query Updates

### For pages/2_💤_Health.py - Query Update

**OLD Query (Lines 60-76)**:
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
WHERE date >= CURRENT_DATE - INTERVAL '{days} days'
ORDER BY date DESC
```

**NEW Query** (with JOIN to get missing columns):
```sql
SELECT 
    wc.date,
    wc.productivity_score,
    wc.health_score,
    wc.sleep_score,
    mp.total_sleep_hours AS sleep_hours,
    mp.work_hours,
    mp.steps,
    wc.mood_level,
    wc.correlation_pattern,
    wc.sleep_7d_avg,
    wc.productivity_7d_avg
FROM main_gold.mart_wellness_correlation wc
LEFT JOIN main_gold.mart_productivity_daily mp
    ON wc.date = mp.date AND wc.user_id = mp.user_id
WHERE wc.date >= CURRENT_DATE - INTERVAL '{days} days'
ORDER BY wc.date DESC
```

**Note**: Verify that `total_sleep_hours`, `work_hours`, and `steps` columns exist in new mart_productivity_daily model.

---

## 6. Data Completeness Check

### Existing Data Models (7 total)

1. **Staging** (3 models):
   - ✅ `main_staging.stg_fitbit_sleep_json` - No column changes
   - ✅ `main_staging.stg_fitbit_activity_json` - No column changes
   - ✅ `main_staging.stg_work_sessions` - Refactored to use dimensions

2. **Intermediate** (2 models):
   - ✅ `main_intermediate.int_daily_health_summary` - Unchanged
   - ✅ `main_intermediate.int_productivity_metrics` - Unchanged

3. **Dimensional** (3 models) - NEW:
   - ✅ `main_dimensions.dim_date` - NEW
   - ✅ `main_dimensions.dim_time` - NEW
   - ✅ `main_dimensions.dim_user` - NEW

4. **Fact** (1 model) - NEW:
   - ✅ `main_facts.fact_work_sessions` - NEW (replaces session-level logic)

5. **Mart** (2 models) - UPDATED:
   - ⚠️ `main_gold.mart_productivity_daily` - Column rename only
   - ⚠️ `main_gold.mart_wellness_correlation` - Structure changed

---

## 7. Issues and Risks

### Critical Issues

1. **Missing `get_table_schema()` function**
   - Location: Referenced in `/Users/junya/Dev/moderation-craft/streamlit/pages/3_🔍_Explorer.py` line 12
   - Impact: Explorer page will fail on tab "Schema Information"
   - Solution: Implement using DuckDB's information_schema

2. **Missing `setup_mock_database()` function**
   - Location: Referenced in multiple pages for fallback data
   - Impact: Mock data won't generate if real database is unavailable
   - Solution: Generate test data from 7 models

3. **Column Name Mismatch in mart_wellness_correlation**
   - Missing: `sleep_hours`, `work_hours`, `steps`
   - Current pages query these directly - will fail
   - Solution: Implement JOIN with mart_productivity_daily

### Potential Issues

4. **Health.py uses columns from wrong table**
   - Lines 345-370: Analysis assumes columns exist in mart_wellness_correlation
   - These columns are now in mart_productivity_daily
   - Need to refactor recommendations logic

5. **Sample query references undefined column**
   - Explorer page sample query #4 uses `sleep_hours`
   - Verify this column name in new mart_productivity_daily model

---

## 8. Testing Checklist

After implementing changes:

- [ ] Test Productivity page loads data successfully
- [ ] Test Health page loads without SQL errors
- [ ] Test Explorer page schema information tab
- [ ] Test Explorer page sample queries execute
- [ ] Verify all 7 dbt models are accessible
- [ ] Test with mock data (once setup_mock_database is implemented)
- [ ] Verify column aggregations work correctly
- [ ] Test date filtering across all pages
- [ ] Verify correlations still calculate correctly

---

## 9. Summary of Changes Required

| File | Priority | Change Type | Lines | Issue |
|------|----------|-------------|-------|-------|
| database.py | HIGH | Add function | - | Missing `get_table_schema()` |
| database.py | HIGH | Add function | - | Missing `setup_mock_database()` |
| pages/2_💤_Health.py | HIGH | Update query | 60-76 | JOIN missing with mart_productivity_daily |
| pages/2_💤_Health.py | HIGH | Update logic | 345-370 | Column references need adjustment |
| pages/3_🔍_Explorer.py | MEDIUM | Update import | 12 | Wait for get_table_schema() implementation |
| pages/3_🔍_Explorer.py | MEDIUM | Verify query | 76-86 | Check sleep_hours column existence |
| mock_data.py | LOW | Add function | 332+ | Complete setup_mock_database() body |
| app.py | LOW | - | - | No changes needed |

---

## 10. Key Takeaways

1. **Good News**: The Streamlit app's main queries are mostly compatible with the new structure
2. **Main Changes**: Dimensional modeling requires JOIN operations for some analyses
3. **Column Renames**: `total_sessions` → `work_sessions` - already handled in new model
4. **New Capabilities**: Access to fact-level data via `fact_work_sessions` enables more detailed analysis
5. **Migration Path**: Can be done incrementally - mart layer is stable interface

---

**Report Generated**: 2025-11-02
**Analysis Scope**: Streamlit app alignment with dbt dimensional modeling
