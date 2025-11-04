"""
睡眠と作業時間の相関分析ページ
前日の睡眠の質が翌日の作業時間に与える影響を分析
"""
import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import numpy as np
from scipy import stats
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils.database import get_connection, run_query

# ページ設定
st.set_page_config(
    page_title="睡眠と作業時間の分析 - ModerationCraft",
    page_icon="😴",
    layout="wide"
)

st.title("睡眠の質が翌日の作業時間に与える影響")
st.markdown("前日の睡眠データと当日の作業時間の関係を分析します")

# プロジェクト一覧取得
@st.cache_data(ttl=3600)
def get_available_projects():
    """利用可能なプロジェクト一覧を取得（dim_projectから）"""
    query = """
    SELECT DISTINCT
        project_id,
        project_name
    FROM main_dimensions.dim_project
    WHERE project_id IS NOT NULL
    ORDER BY project_id
    """
    try:
        conn = get_connection()
        df = run_query(query, conn)
        return df
    except Exception as e:
        st.error(f"プロジェクト取得エラー: {e}")
        return pd.DataFrame()

# サイドバー設定
with st.sidebar:
    st.header("分析設定")

    # プロジェクトフィルタ
    projects_df = get_available_projects()
    if not projects_df.empty:
        project_options = dict(zip(projects_df['project_id'], projects_df['project_name']))
        selected_projects = st.multiselect(
            "プロジェクトフィルタ",
            options=list(project_options.keys()),
            format_func=lambda x: project_options[x],
            default=list(project_options.keys()),
            help="分析対象のプロジェクトを選択してください"
        )
    else:
        selected_projects = []
        st.warning("プロジェクトデータが見つかりません")

    # 分析期間
    analysis_period = st.slider(
        "分析期間（日数）",
        min_value=7,
        max_value=180,
        value=90,
        step=7
    )

    # データ品質フィルター
    min_work_hours = st.slider(
        "最低作業時間（時間）",
        min_value=0.0,
        max_value=4.0,
        value=0.5,
        step=0.5,
        help="このフィルターより少ない作業時間の日は除外されます"
    )

    st.divider()
    st.info("""
    **分析内容**
    - 前日の睡眠時間/スコア
    - 当日の作業時間
    - 相関係数と統計的有意性
    - 最適な睡眠時間の特定
    """)

# データ取得
@st.cache_data(ttl=3600)
def load_sleep_work_data(days: int, project_ids: list):
    """睡眠と作業時間のデータを取得（mart_sleep_work_correlationから）"""
    # プロジェクトIDのリストをSQLに埋め込む形式に変換
    project_filter = "','".join(project_ids) if project_ids else ""

    query = f"""
    SELECT
        date,
        day_of_week,
        project_id,

        -- 前日の睡眠データ
        prev_sleep_hours,
        prev_sleep_efficiency AS prev_sleep_score,
        prev_sleep_category,
        prev_sleep_score,
        prev_deep_sleep_minutes,
        prev_rem_sleep_minutes,

        -- 当日の作業データ
        work_hours,
        total_sessions,
        avg_session_duration,
        avg_focus_score AS focus_score,
        avg_mood_level AS mood_level,
        avg_dopamine_level AS dopamine_level,

        -- 当日の睡眠データ（参考用）
        current_sleep_hours,
        current_sleep_score,

        -- トレンドデータ
        sleep_7d_avg,
        work_7d_avg,
        focus_7d_avg,

        -- フラグ
        is_optimal_sleep,
        is_sleep_deprived,
        is_high_productivity_day,
        is_low_productivity_day

    FROM main_gold.mart_sleep_work_correlation
    WHERE date >= CURRENT_DATE - INTERVAL '{days} days'
        {f"AND project_id IN ('{project_filter}')" if project_filter else ""}
    ORDER BY date
    """

    try:
        conn = get_connection()
        df = run_query(query, conn)

        if df.empty:
            st.warning("データが見つかりませんでした。dbt runを実行してください。")
            return pd.DataFrame()

        # データ型の変換
        df['date'] = pd.to_datetime(df['date'])

        return df
    except Exception as e:
        st.error(f"データ取得エラー: {e}")
        st.info("mart_sleep_work_correlationマートを実行してください:")
        st.code("cd dbt && dbt run --select mart_sleep_work_correlation", language="bash")
        return pd.DataFrame()

# データ読み込み
if not selected_projects:
    st.warning("プロジェクトを1つ以上選択してください。")
    st.stop()

df = load_sleep_work_data(analysis_period, selected_projects)

if df.empty:
    st.warning("データが存在しません。dbtモデルを実行してください。")
    st.code("cd dbt && dbt run --select +mart_sleep_work_correlation", language="bash")
    st.stop()

# データフィルタリング
df_filtered = df[df['work_hours'] >= min_work_hours].copy()

if df_filtered.empty:
    st.warning(f"作業時間が{min_work_hours}時間以上の日がありません。フィルターを調整してください。")
    st.stop()

# 選択プロジェクト情報の表示
if len(selected_projects) == len(project_options):
    project_info = "全プロジェクト"
elif len(selected_projects) == 1:
    project_info = f"{project_options[selected_projects[0]]}"
else:
    project_info = f"{len(selected_projects)}プロジェクト選択中"

st.info(f"分析対象: {project_info} | 期間: {len(df_filtered)}日間")

# KPI表示
col1, col2, col3, col4 = st.columns(4)

with col1:
    avg_sleep = df_filtered['prev_sleep_hours'].mean()
    st.metric(
        "平均睡眠時間",
        f"{avg_sleep:.1f}時間",
        delta=None
    )

with col2:
    avg_work = df_filtered['work_hours'].mean()
    st.metric(
        "平均作業時間",
        f"{avg_work:.1f}時間",
        delta=None
    )

with col3:
    correlation = df_filtered[['prev_sleep_hours', 'work_hours']].corr().iloc[0, 1]
    st.metric(
        "相関係数",
        f"{correlation:.3f}",
        delta=None,
        help="1に近いほど正の相関が強い"
    )

with col4:
    # 最適睡眠時間（作業時間が最大になる睡眠時間の平均）
    top_work_days = df_filtered.nlargest(int(len(df_filtered) * 0.2), 'work_hours')
    optimal_sleep = top_work_days['prev_sleep_hours'].mean()
    st.metric(
        "最適睡眠時間",
        f"{optimal_sleep:.1f}時間",
        delta=None,
        help="作業時間が長かった日の平均睡眠時間"
    )

st.divider()

# タブ構成
tab1, tab2, tab3, tab4 = st.tabs([
    "📈 相関分析",
    "📊 トレンド分析",
    "🎯 カテゴリ分析",
    "💡 インサイト"
])

with tab1:
    st.subheader("前日の睡眠時間 vs 当日の作業時間")

    # 散布図（回帰線付き）
    fig = px.scatter(
        df_filtered,
        x='prev_sleep_hours',
        y='work_hours',
        color='prev_sleep_category',
        size='total_sessions',
        hover_data=['date', 'day_of_week', 'prev_sleep_score', 'focus_score'],
        trendline='ols',
        title='睡眠時間と作業時間の相関',
        labels={
            'prev_sleep_hours': '前日の睡眠時間（時間）',
            'work_hours': '当日の作業時間（時間）',
            'prev_sleep_category': '睡眠カテゴリ',
            'total_sessions': 'セッション数'
        },
        height=500
    )

    fig.update_layout(
        xaxis=dict(range=[0, df_filtered['prev_sleep_hours'].max() + 1]),
        yaxis=dict(range=[0, df_filtered['work_hours'].max() + 1])
    )

    st.plotly_chart(fig, use_container_width=True)

    # 統計情報
    col1, col2, col3 = st.columns(3)

    # 回帰分析
    valid_data = df_filtered.dropna(subset=['prev_sleep_hours', 'work_hours'])
    if len(valid_data) >= 3:
        slope, intercept, r_value, p_value, std_err = stats.linregress(
            valid_data['prev_sleep_hours'],
            valid_data['work_hours']
        )

        with col1:
            st.metric("回帰式の傾き", f"{slope:.3f}")
            st.caption("睡眠1時間増加あたりの作業時間変化")

        with col2:
            st.metric("決定係数 R²", f"{r_value**2:.3f}")
            st.caption("モデルの説明力（1に近いほど良い）")

        with col3:
            significance = "有意" if p_value < 0.05 else "非有意"
            st.metric("統計的有意性", significance)
            st.caption(f"p値: {p_value:.4f}")

        st.info(f"""
        **📐 回帰式:** 作業時間 = {slope:.3f} × 睡眠時間 + {intercept:.3f}

        解釈: 睡眠時間が1時間増えると、作業時間が平均{slope:.3f}時間{'増加' if slope > 0 else '減少'}します。
        """)

with tab2:
    st.subheader("睡眠と作業時間のトレンド")

    # デュアル軸チャート
    fig = make_subplots(specs=[[{"secondary_y": True}]])

    # 睡眠時間（棒グラフ）
    fig.add_trace(
        go.Bar(
            x=df_filtered['date'],
            y=df_filtered['prev_sleep_hours'],
            name='前日の睡眠時間',
            marker_color='lightblue',
            opacity=0.6
        ),
        secondary_y=False
    )

    # 作業時間（折れ線グラフ）
    fig.add_trace(
        go.Scatter(
            x=df_filtered['date'],
            y=df_filtered['work_hours'],
            name='作業時間',
            line=dict(color='green', width=2),
            mode='lines+markers'
        ),
        secondary_y=True
    )

    # 7日移動平均を追加（martから取得済み）
    if len(df_filtered) >= 7:
        fig.add_trace(
            go.Scatter(
                x=df_filtered['date'],
                y=df_filtered['sleep_7d_avg'],
                name='睡眠7日平均',
                line=dict(color='blue', width=2, dash='dash')
            ),
            secondary_y=False
        )

        fig.add_trace(
            go.Scatter(
                x=df_filtered['date'],
                y=df_filtered['work_7d_avg'],
                name='作業7日平均',
                line=dict(color='darkgreen', width=2, dash='dash')
            ),
            secondary_y=True
        )

    fig.update_xaxes(title_text="日付")
    fig.update_yaxes(title_text="睡眠時間（時間）", secondary_y=False)
    fig.update_yaxes(title_text="作業時間（時間）", secondary_y=True)

    fig.update_layout(
        title="時系列トレンド比較",
        height=500,
        hovermode='x unified'
    )

    st.plotly_chart(fig, use_container_width=True)

    # 曜日別分析
    st.subheader("曜日別の傾向")

    col1, col2 = st.columns(2)

    with col1:
        # 曜日別平均睡眠時間
        day_sleep = df_filtered.groupby('day_of_week')['prev_sleep_hours'].mean().reset_index()
        day_order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        day_sleep['day_of_week'] = pd.Categorical(day_sleep['day_of_week'], categories=day_order, ordered=True)
        day_sleep = day_sleep.sort_values('day_of_week')

        fig = px.bar(
            day_sleep,
            x='day_of_week',
            y='prev_sleep_hours',
            title='曜日別平均睡眠時間',
            labels={'day_of_week': '曜日', 'prev_sleep_hours': '睡眠時間（時間）'},
            color='prev_sleep_hours',
            color_continuous_scale='Blues'
        )
        st.plotly_chart(fig, use_container_width=True)

    with col2:
        # 曜日別平均作業時間
        day_work = df_filtered.groupby('day_of_week')['work_hours'].mean().reset_index()
        day_work['day_of_week'] = pd.Categorical(day_work['day_of_week'], categories=day_order, ordered=True)
        day_work = day_work.sort_values('day_of_week')

        fig = px.bar(
            day_work,
            x='day_of_week',
            y='work_hours',
            title='曜日別平均作業時間',
            labels={'day_of_week': '曜日', 'work_hours': '作業時間（時間）'},
            color='work_hours',
            color_continuous_scale='Greens'
        )
        st.plotly_chart(fig, use_container_width=True)

with tab3:
    st.subheader("睡眠カテゴリ別分析")

    col1, col2 = st.columns(2)

    with col1:
        # ボックスプロット: 睡眠カテゴリごとの作業時間分布
        category_order = ['5<', '5-6', '6-7', '7-8', '8-9', '9+']
        df_filtered_cat = df_filtered[df_filtered['prev_sleep_category'].notna()]

        fig = px.box(
            df_filtered_cat,
            x='prev_sleep_category',
            y='work_hours',
            title='睡眠カテゴリ別の作業時間分布',
            labels={
                'prev_sleep_category': '睡眠カテゴリ（時間）',
                'work_hours': '作業時間（時間）'
            },
            category_orders={'prev_sleep_category': category_order},
            color='prev_sleep_category',
            height=400
        )
        st.plotly_chart(fig, use_container_width=True)

    with col2:
        # 睡眠カテゴリ別の平均作業時間
        category_avg = df_filtered.groupby('prev_sleep_category').agg({
            'work_hours': 'mean',
            'date': 'count'
        }).reset_index()
        category_avg.columns = ['prev_sleep_category', 'avg_work_hours', 'count']

        fig = px.bar(
            category_avg,
            x='prev_sleep_category',
            y='avg_work_hours',
            title='睡眠カテゴリ別平均作業時間',
            labels={
                'prev_sleep_category': '睡眠カテゴリ（時間）',
                'avg_work_hours': '平均作業時間（時間）'
            },
            text='count',
            color='avg_work_hours',
            color_continuous_scale='Viridis',
            height=400
        )
        fig.update_traces(texttemplate='%{text}日', textposition='outside')
        st.plotly_chart(fig, use_container_width=True)

    # ヒートマップ: 睡眠カテゴリ × 曜日
    st.subheader("睡眠カテゴリ × 曜日の作業時間ヒートマップ")

    heatmap_data = df_filtered.pivot_table(
        values='work_hours',
        index='prev_sleep_category',
        columns='day_of_week',
        aggfunc='mean'
    )

    # 曜日順に並び替え
    day_order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    heatmap_data = heatmap_data.reindex(columns=[d for d in day_order if d in heatmap_data.columns])

    fig = px.imshow(
        heatmap_data,
        labels=dict(x="曜日", y="睡眠カテゴリ", color="作業時間"),
        x=heatmap_data.columns,
        y=heatmap_data.index,
        color_continuous_scale='RdYlGn',
        aspect='auto',
        title='睡眠カテゴリ × 曜日 別の平均作業時間',
        height=400
    )
    st.plotly_chart(fig, use_container_width=True)

with tab4:
    st.subheader("🔍 主要インサイト")

    # 最近のトレンド
    recent_7d = df_filtered.tail(7)
    avg_recent_sleep = recent_7d['prev_sleep_hours'].mean()
    avg_recent_work = recent_7d['work_hours'].mean()

    col1, col2 = st.columns(2)

    with col1:
        st.markdown("### 直近7日間の傾向")
        st.metric("平均睡眠時間", f"{avg_recent_sleep:.1f}時間")
        st.metric("平均作業時間", f"{avg_recent_work:.1f}時間")

        # トレンド判定
        if len(df_filtered) >= 14:
            prev_7d = df_filtered.iloc[-14:-7]
            sleep_change = avg_recent_sleep - prev_7d['prev_sleep_hours'].mean()
            work_change = avg_recent_work - prev_7d['work_hours'].mean()

            if sleep_change > 0 and work_change > 0:
                st.success("睡眠・作業時間ともに改善傾向")
            elif sleep_change < 0 and work_change < 0:
                st.warning("睡眠・作業時間ともに減少傾向")
            else:
                st.info("混合的なトレンド")

    with col2:
        st.markdown("### 最適な睡眠時間帯")

        # 作業時間が多い日の睡眠時間分布
        top_20_percent = int(len(df_filtered) * 0.2)
        top_work_days = df_filtered.nlargest(top_20_percent, 'work_hours')

        sleep_range = (
            top_work_days['prev_sleep_hours'].quantile(0.25),
            top_work_days['prev_sleep_hours'].quantile(0.75)
        )

        st.metric(
            "推奨睡眠時間範囲",
            f"{sleep_range[0]:.1f} - {sleep_range[1]:.1f}時間"
        )
        st.caption("作業時間が長かった日（上位20%）の睡眠時間の範囲（第1四分位〜第3四分位）")

        optimal_category = top_work_days['prev_sleep_category'].mode()
        if len(optimal_category) > 0:
            st.info(f"最も生産的な睡眠カテゴリ: **{optimal_category[0]}時間**")

    st.divider()

    # 睡眠不足の影響分析
    st.markdown("### 睡眠不足の影響")

    # 睡眠時間別のグループ分け
    df_filtered['sleep_group'] = pd.cut(
        df_filtered['prev_sleep_hours'],
        bins=[0, 6, 7, 8, 12],
        labels=['不足(<6h)', '少なめ(6-7h)', '適正(7-8h)', '多め(8h+)']
    )

    sleep_impact = df_filtered.groupby('sleep_group').agg({
        'work_hours': ['mean', 'count'],
        'focus_score': 'mean'
    }).round(2)

    sleep_impact.columns = ['平均作業時間', '日数', '平均集中度']

    st.dataframe(sleep_impact, use_container_width=True)

    # 睡眠不足日と適正睡眠日の比較
    if '不足(<6h)' in df_filtered['sleep_group'].values and '適正(7-8h)' in df_filtered['sleep_group'].values:
        short_sleep = df_filtered[df_filtered['sleep_group'] == '不足(<6h)']['work_hours'].mean()
        optimal_sleep_work = df_filtered[df_filtered['sleep_group'] == '適正(7-8h)']['work_hours'].mean()

        if short_sleep > 0:
            reduction_pct = ((optimal_sleep_work - short_sleep) / short_sleep * 100)

            if reduction_pct > 0:
                st.warning(f"""
                ⚠️ **睡眠不足の影響**

                睡眠時間が6時間未満の日は、7-8時間睡眠の日と比較して
                作業時間が平均 **{reduction_pct:.1f}%** 減少しています。

                - 睡眠不足時: {short_sleep:.1f}時間
                - 適正睡眠時: {optimal_sleep_work:.1f}時間
                """)
            else:
                st.info("睡眠時間による作業時間の明確な差は見られません。")

    st.divider()

    # アクションアイテム
    st.markdown("### 改善アクション")

    if correlation > 0.3:
        st.success("""
        **相関が確認されました！**

        1. **目標睡眠時間**: {:.1f}時間を目指しましょう
        2. **就寝時刻の固定**: 毎日同じ時間に寝る習慣をつける
        3. **睡眠環境の改善**: 寝室の温度・照明を最適化
        4. **就寝前のルーティン**: スクリーンタイムを減らす
        """.format(optimal_sleep))
    elif correlation < -0.3:
        st.warning("""
        **負の相関が見られます**

        睡眠時間が長いほど作業時間が短くなる傾向があります。
        - 睡眠の質を改善することを優先してください
        - 日中の活動量を増やすことを検討してください
        """)
    else:
        st.info("""
        **相関は弱いです**

        睡眠時間と作業時間の間に明確な関係は見られません。
        - 他の要因（気分、環境など）を分析してみましょう
        - データ収集を継続して長期トレンドを確認してください
        """)
