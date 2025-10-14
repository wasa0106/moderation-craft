{% macro test_not_null_where(model, column_name, condition) %}
  SELECT *
  FROM {{ model }}
  WHERE {{ column_name }} IS NULL
    AND {{ condition }}
{% endmacro %}

{% macro test_unique_combination(model, combination) %}
  SELECT
    {{ combination | join(', ') }},
    COUNT(*) as count
  FROM {{ model }}
  GROUP BY {{ combination | join(', ') }}
  HAVING COUNT(*) > 1
{% endmacro %}

{% macro test_date_range(model, date_column, days_back=7) %}
  SELECT *
  FROM {{ model }}
  WHERE {{ date_column }} < CURRENT_DATE - INTERVAL '{{ days_back }} days'
     OR {{ date_column }} > CURRENT_DATE
{% endmacro %}

{% macro test_value_in_range(model, column_name, min_value, max_value) %}
  SELECT *
  FROM {{ model }}
  WHERE {{ column_name }} < {{ min_value }}
     OR {{ column_name }} > {{ max_value }}
{% endmacro %}

{% macro test_referential_integrity(model, column_name, ref_model, ref_column) %}
  SELECT m.*
  FROM {{ model }} m
  LEFT JOIN {{ ref_model }} r
    ON m.{{ column_name }} = r.{{ ref_column }}
  WHERE r.{{ ref_column }} IS NULL
    AND m.{{ column_name }} IS NOT NULL
{% endmacro %}