# Streamlit App Updates - Implementation Checklist

## Quick Reference

### Files Affected: 4 High Priority + 3 Medium Priority

```
streamlit/
├── utils/
│   ├── database.py          ⚠️ HIGH  - Add 2 missing functions
│   └── mock_data.py         🔵 LOW   - Complete existing function
├── app.py                   ✅ DONE  - No changes needed
└── pages/
    ├── 1_📊_Productivity.py ✅ DONE  - Query compatible
    ├── 2_💤_Health.py       ⚠️ HIGH  - Update 2 queries/logic
    └── 3_🔍_Explorer.py     🟡 MED   - Fix import + verify query
```

---

## HIGH PRIORITY Issues (Breaking Changes)

### 1. Fix: `database.py` - Add Missing Functions

**Location**: `/Users/junya/Dev/moderation-craft/streamlit/utils/database.py`

**Status**: ❌ Missing 2 functions that are actively used

```python
# MISSING FUNCTION #1: get_table_schema()
# Used in: pages/3_🔍_Explorer.py line 268
# Purpose: Get column information for selected table

def get_table_schema(table_name: str) -> pd.DataFrame:
    """Get schema information for a table"""
    try:
        conn = get_connection()
        schema_df = conn.execute(f"""
            SELECT 
                column_name,
                data_type,
                is_nullable
            FROM information_schema.columns
            WHERE table_name = '{table_name}'
            ORDER BY ordinal_position
        """).df()
        return schema_df
    except:
        return pd.DataFrame()

# MISSING FUNCTION #2: setup_mock_database()
# Used in: pages/1_📊_Productivity.py line 90
#          pages/2_💤_Health.py line 81
#          pages/3_🔍_Explorer.py line 38
# Purpose: Generate mock data when real database is unavailable

def setup_mock_database(conn):
    """Setup mock data in database"""
    from utils.mock_data import generate_mock_data
    
    mock_data = generate_mock_data(days=30)
    
    for table_name, df in mock_data.items():
        table_name_sql = table_name.replace('-', '_')
        conn.execute(f"DROP TABLE IF EXISTS {table_name_sql}")
        conn.execute(f"CREATE TABLE {table_name_sql} AS SELECT * FROM df")
    
    return list(mock_data.keys())
```

---

### 2. Fix: `pages/2_💤_Health.py` - Update Correlation Query

**Location**: Lines 60-76

**Problem**: 
- Query selects `sleep_hours`, `work_hours`, `steps` from `mart_wellness_correlation`
- These columns NO LONGER exist in new model structure
- They are now in `mart_productivity_daily`

**Current Query** (BROKEN):
```python
query = f"""
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
"""
```

**Fixed Query** (WITH JOIN):
```python
query = f"""
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
"""
```

**Additional Fix Required**: 
- Lines 345-370: Update column references in analysis logic
- These columns are now accessed via the JOIN alias `mp.`

---

### 3. Fix: `pages/2_💤_Health.py` - Update Analysis Logic

**Location**: Lines 345-370 (Recommendations section)

**Problem**: Code tries to access columns that came from the broken query

**Example Fix Needed**:
```python
# Line 346: OLD CODE
if 'sleep_score' in df.columns:
    avg_sleep = df['sleep_score'].mean()
    if avg_sleep < 70:
        recommendations.append("🛏️ 睡眠の質を改善しましょう...")

# This STILL WORKS because sleep_score exists in mart_wellness_correlation

# Line 356-360: NEEDS CHECKING
if 'health_score' in df.columns:
    health_trend = df['health_score'].iloc[0] - df['health_score'].iloc[-1]
    
# This WORKS because health_score is in mart_wellness_correlation

# BUT LINES THAT USE sleep_hours, work_hours, steps WILL FAIL
# Example - if any code tries:
# avg_work = df['work_hours'].mean()  # ← This will fail without JOIN
```

---

## MEDIUM PRIORITY Issues

### 4. Fix: `pages/3_🔍_Explorer.py` - Import Error

**Location**: Line 12

**Problem**: 
```python
from utils.database import get_connection, run_query, get_available_tables, get_table_schema
```
- `get_table_schema` is not defined
- This import fails when file is loaded

**Solution**: 
- First implement `get_table_schema()` in `database.py` (see High Priority #1)
- Then this import will work

---

### 5. Verify: `pages/3_🔍_Explorer.py` - Sample Query #4

**Location**: Lines 76-86

**Query**:
```python
"トップ10生産的な日": """
SELECT 
    date,
    productivity_score,
    health_score,
    work_hours,
    sleep_hours
FROM mart_productivity_daily
ORDER BY productivity_score DESC
LIMIT 10
"""
```

**Action Required**: Verify column names
- ✅ `date` - Exists
- ✅ `productivity_score` - Exists
- ✅ `health_score` - Exists
- ✅ `work_hours` - Exists
- ❓ `sleep_hours` - VERIFY IN MART_PRODUCTIVITY_DAILY

**Check Command**:
```sql
SELECT * FROM main_gold.mart_productivity_daily LIMIT 1;
-- Look for column: sleep_hours, total_sleep_hours, or similar
```

---

## LOW PRIORITY Issues

### 6. Complete: `utils/mock_data.py` - Setup Function

**Location**: End of file (after line 332)

**Purpose**: This function is incomplete and needs implementation

**Current State**:
```python
def generate_mock_data(days: int = 30) -> dict:
    """Generate mock data for 7 dbt models"""
    # ... 330 lines of mock data generation ...
    return {
        'stg_fitbit_sleep_json': stg_fitbit_sleep,
        'stg_fitbit_activity_json': stg_fitbit_activity,
        'stg_work_sessions': stg_work_sessions,
        'int_daily_health_summary': int_daily_health,
        'int_productivity_metrics': int_productivity,
        'mart_productivity_daily': mart_productivity_daily,
        'mart_wellness_correlation': mart_wellness_correlation,
    }

# ❌ MISSING: setup_mock_database() function body
```

**Needs Addition**:
```python
def setup_mock_database(conn):
    """Generate and load mock data into database"""
    try:
        mock_data = generate_mock_data(days=30)
        
        for table_name, df in mock_data.items():
            table_name_sql = table_name.replace('-', '_')
            # Drop existing table
            conn.execute(f"DROP TABLE IF EXISTS {table_name_sql}")
            # Create from DataFrame
            conn.register(table_name_sql, df)
            conn.execute(f"CREATE TABLE {table_name_sql} AS SELECT * FROM {table_name_sql}")
        
        return list(mock_data.keys())
    except Exception as e:
        print(f"Mock database setup failed: {e}")
        return []
```

---

## COLUMN MAPPING REFERENCE

### mart_productivity_daily (Updated Model)

| Column | Old Name | Status | Type |
|--------|----------|--------|------|
| user_id | user_id | ✅ Exists | VARCHAR |
| date | date | ✅ Exists | DATE |
| day_of_week | day_of_week | ✅ Exists | VARCHAR |
| week_number | week_number | ✅ Exists | INTEGER |
| month | month | ✅ Exists | INTEGER |
| year | year | ✅ Exists | INTEGER |
| quarter | quarter | ✅ Exists | INTEGER |
| sleep_score | sleep_score | ✅ Exists | DECIMAL |
| activity_score | activity_score | ✅ Exists | DECIMAL |
| health_score | health_score | ✅ Exists | DECIMAL |
| total_sleep_hours | ❓ | ⚠️ Verify | DECIMAL |
| sleep_quality_category | sleep_quality_category | ✅ Exists | VARCHAR |
| steps | steps | ✅ Exists | INTEGER |
| activity_level | activity_level | ✅ Exists | VARCHAR |
| work_sessions | total_sessions | ✅ Renamed | INTEGER |
| work_hours | work_hours | ✅ Exists | DECIMAL |
| avg_session_duration | avg_session_duration | ✅ Exists | DECIMAL |
| pomodoro_rate | pomodoro_rate | ✅ Exists | DECIMAL |
| productivity_score | productivity_score | ✅ Exists | DECIMAL |
| focus_score | focus_score | ✅ Exists | DECIMAL |
| mood_level | avg_mood | ✅ Renamed | DECIMAL |
| dopamine_level | avg_dopamine | ✅ Renamed | DECIMAL |
| most_productive_time_slot | most_productive_time_slot | ✅ Exists | VARCHAR |
| wellness_productivity_index | wellness_productivity_index | ✅ Exists | DECIMAL |
| performance_category | performance_category | ✅ Exists | VARCHAR |
| data_completeness | data_completeness | ✅ Exists | VARCHAR |
| calculated_at | calculated_at | ✅ Exists | TIMESTAMP |

### mart_wellness_correlation (Structure Changed)

| Column | Location | Status |
|--------|----------|--------|
| id | mart_wellness_correlation | ✅ Exists |
| user_id | mart_wellness_correlation | ✅ Exists |
| date | mart_wellness_correlation | ✅ Exists |
| day_of_week | mart_wellness_correlation | ✅ Exists |
| week_number | mart_wellness_correlation | ✅ Exists |
| month | mart_wellness_correlation | ✅ Exists |
| year | mart_wellness_correlation | ✅ Exists |
| sleep_score | mart_wellness_correlation | ✅ Exists |
| activity_score | mart_wellness_correlation | ✅ Exists |
| health_score | mart_wellness_correlation | ✅ Exists |
| productivity_score | mart_wellness_correlation | ✅ Exists |
| mood_level | mart_wellness_correlation | ✅ Exists |
| dopamine_level | mart_wellness_correlation | ✅ Exists |
| sleep_change | mart_wellness_correlation | ✅ Exists |
| productivity_change | mart_wellness_correlation | ✅ Exists |
| mood_change | mart_wellness_correlation | ✅ Exists |
| sleep_7d_avg | mart_wellness_correlation | ✅ Exists |
| activity_7d_avg | mart_wellness_correlation | ✅ Exists |
| productivity_7d_avg | mart_wellness_correlation | ✅ Exists |
| sleep_trend | mart_wellness_correlation | ✅ Exists |
| productivity_trend | mart_wellness_correlation | ✅ Exists |
| correlation_pattern | mart_wellness_correlation | ✅ Exists |
| sleep_impact_on_productivity | mart_wellness_correlation | ✅ Exists |
| weekly_performance | mart_wellness_correlation | ✅ Exists |
| significant_change | mart_wellness_correlation | ✅ Exists |
| needs_intervention | mart_wellness_correlation | ✅ Exists |
| calculated_at | mart_wellness_correlation | ✅ Exists |
| **sleep_hours** | mart_productivity_daily | ❌ JOIN REQUIRED |
| **work_hours** | mart_productivity_daily | ❌ JOIN REQUIRED |
| **steps** | mart_productivity_daily | ❌ JOIN REQUIRED |
| **total_sleep_hours** | mart_productivity_daily | ❓ VERIFY NAME |

---

## Testing Commands

After implementing fixes, test with:

```bash
# Test database connection
cd /Users/junya/Dev/moderation-craft/streamlit
python -c "from utils.database import get_connection; conn = get_connection(); print('✅ Connection OK')"

# Test that functions exist
python -c "from utils.database import get_table_schema, setup_mock_database; print('✅ Functions imported')"

# Run streamlit app
streamlit run app.py

# Test each page loads without errors
# - Main page (app.py) - should work immediately
# - Productivity (pages/1_📊_Productivity.py) - should work
# - Health (pages/2_💤_Health.py) - after fix #2 and #3
# - Explorer (pages/3_🔍_Explorer.py) - after fixes #1 and #5
```

---

## Implementation Order

1. ✅ **Step 1**: Add `get_table_schema()` to database.py
2. ✅ **Step 2**: Add `setup_mock_database()` to database.py
3. ✅ **Step 3**: Update query in pages/2_💤_Health.py (lines 60-76)
4. ✅ **Step 4**: Update analysis logic in pages/2_💤_Health.py (lines 345-370)
5. 🔍 **Step 5**: Verify column name for `sleep_hours` in new mart_productivity_daily
6. ✅ **Step 6**: Complete mock_data.py setup function
7. ✅ **Step 7**: Test all pages load without errors
8. ✅ **Step 8**: Verify data displays correctly in all visualizations

---

## Related dbt Models (Reference)

```
dbt/models/
├── staging/
│   ├── stg_fitbit_sleep_json.sql    ✅ No changes
│   ├── stg_fitbit_activity_json.sql ✅ No changes
│   └── stg_work_sessions.sql        ⚠️ Now uses dim tables
├── intermediate/
│   ├── int_daily_health_summary.sql ✅ No changes
│   └── int_productivity_metrics.sql ✅ No changes
├── dimensions/ (NEW)
│   ├── dim_date.sql                 ✅ NEW
│   ├── dim_time.sql                 ✅ NEW
│   └── dim_user.sql                 ✅ NEW
├── facts/ (NEW)
│   └── fact_work_sessions.sql       ✅ NEW (session-level granularity)
└── marts/
    ├── mart_productivity_daily.sql  ⚠️ Column rename: total_sessions → work_sessions
    └── mart_wellness_correlation.sql ⚠️ Structure change: lost 3 columns
```

