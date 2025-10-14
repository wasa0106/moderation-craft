{% macro date_spine(start_date, end_date) %}
  WITH RECURSIVE dates AS (
    SELECT DATE '{{ start_date }}' as date_day
    UNION ALL
    SELECT date_day + INTERVAL '1 day'
    FROM dates
    WHERE date_day < DATE '{{ end_date }}'
  )
  SELECT * FROM dates
{% endmacro %}

{% macro get_jst_timestamp() %}
  CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo'
{% endmacro %}

{% macro days_ago(n) %}
  CURRENT_DATE - INTERVAL '{{ n }} days'
{% endmacro %}

{% macro format_date_partition(date_column) %}
  strftime({{ date_column }}, 'year=%Y/month=%m/day=%d')
{% endmacro %}

{% macro week_start(date_column) %}
  DATE_TRUNC('week', {{ date_column }})
{% endmacro %}

{% macro month_start(date_column) %}
  DATE_TRUNC('month', {{ date_column }})
{% endmacro %}