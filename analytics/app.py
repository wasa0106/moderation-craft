"""
ModerationCraft Analytics Dashboard
メインダッシュボード
"""
import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime, timedelta
from utils.database import get_connection, get_mock_connection, run_query, get_available_tables
from utils.mock_data import setup_mock_database

# ページ設定
st.set_page_config(
    page_title="ModerationCraft Analytics",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded"
)

# スタイル適用
st.markdown("""
<style>
    .main-header {
        font-size: 2.5rem;
        font-weight: bold;
        margin-bottom: 0.5rem;
    }
    .metric-card {
        background-color: #1e1e1e;
        padding: 1rem;
        border-radius: 0.5rem;
        margin: 0.5rem 0;
    }
</style>
""", unsafe_allow_html=True)

# タイトル
st.markdown('<h1 class="main-header">🎯 ModerationCraft Analytics</h1>', unsafe_allow_html=True)

# サイドバー設定
with st.sidebar:
    st.header("⚙️ 設定")

    # データソース選択
    data_source = st.radio(
        "データソース",
        ["モックデータ", "DBファイル"],
        help="DBファイルが見つからない場合は自動的にモックデータを使用します"
    )

    # 日付範囲選択
    date_range = st.slider(
        "分析期間（日数）",
        min_value=7,
        max_value=90,
        value=30,
        step=7
    )

    # データベース初期化
    if data_source == "モックデータ":
        # モックデータ用のメモリDB接続
        mock_conn = get_mock_connection()
        with st.spinner("モックデータを生成中..."):
            tables = setup_mock_database(mock_conn)
            st.success(f"✅ {len(tables)}個のテーブルを作成しました")
        # グローバル接続を更新（run_queryで使用される）
        conn = mock_conn
    else:
        # DBファイル使用時
        conn = get_connection()
        tables = get_available_tables()
        if tables:
            st.sidebar.info(f"📊 {len(tables)}個のテーブルが利用可能")
        else:
            st.sidebar.warning("⚠️ テーブルが見つかりません")

# データ取得
@st.cache_data(ttl=300)  # 5分間キャッシュ
def load_dashboard_data(days: int):
    """ダッシュボード用データを取得"""

    # 基本データ取得
    query = f"""
        SELECT * FROM mart_productivity_daily
        WHERE date >= CURRENT_DATE - INTERVAL '{days} days'
        ORDER BY date DESC
    """

    try:
        df = run_query(query)
        return df
    except Exception as e:
        st.warning(f"データ取得エラー: {str(e)[:100]}")
        return pd.DataFrame()

# データ読み込み
df = load_dashboard_data(date_range)

if not df.empty:
    # メトリクス計算
    latest_date = df['date'].max()
    latest_data = df[df['date'] == latest_date].iloc[0]
    prev_week_data = df[df['date'] == latest_date - timedelta(days=7)]

    # 平均値計算
    avg_productivity = df['productivity_score'].mean()
    avg_health = df['health_score'].mean()
    avg_work_hours = df['work_hours'].mean()

    # 前週比較
    if not prev_week_data.empty:
        prev_productivity = prev_week_data['productivity_score'].iloc[0]
        prev_health = prev_week_data['health_score'].iloc[0]
        productivity_delta = latest_data['productivity_score'] - prev_productivity
        health_delta = latest_data['health_score'] - prev_health
    else:
        productivity_delta = 0
        health_delta = 0

    # KPIカード表示
    st.markdown("### 📈 主要指標")
    col1, col2, col3, col4 = st.columns(4)

    with col1:
        st.metric(
            label="生産性スコア",
            value=f"{latest_data['productivity_score']:.1f}",
            delta=f"{productivity_delta:+.1f}",
            help="最新の生産性スコア（前週比）"
        )

    with col2:
        st.metric(
            label="健康スコア",
            value=f"{latest_data['health_score']:.1f}",
            delta=f"{health_delta:+.1f}",
            help="最新の健康スコア（前週比）"
        )

    with col3:
        st.metric(
            label="平均作業時間",
            value=f"{avg_work_hours:.1f}h",
            help=f"過去{date_range}日間の平均"
        )

    with col4:
        st.metric(
            label="平均生産性",
            value=f"{avg_productivity:.1f}",
            help=f"過去{date_range}日間の平均"
        )

    # グラフ表示
    st.markdown("### 📊 トレンド分析")

    # タブで切り替え
    tab1, tab2, tab3 = st.tabs(["時系列", "分布", "相関"])

    with tab1:
        # 時系列グラフ
        fig = go.Figure()

        fig.add_trace(go.Scatter(
            x=df['date'],
            y=df['productivity_score'],
            mode='lines+markers',
            name='生産性スコア',
            line=dict(color='#FF6B6B', width=2),
            marker=dict(size=6)
        ))

        fig.add_trace(go.Scatter(
            x=df['date'],
            y=df['health_score'],
            mode='lines+markers',
            name='健康スコア',
            line=dict(color='#4ECDC4', width=2),
            marker=dict(size=6)
        ))

        fig.update_layout(
            title="生産性と健康スコアの推移",
            xaxis_title="日付",
            yaxis_title="スコア",
            hovermode='x unified',
            height=400,
            template="plotly_white"
        )

        st.plotly_chart(fig, use_container_width=True)

    with tab2:
        # 分布グラフ
        col1, col2 = st.columns(2)

        with col1:
            fig_hist = px.histogram(
                df,
                x='productivity_score',
                nbins=20,
                title="生産性スコア分布",
                labels={'productivity_score': '生産性スコア', 'count': '頻度'},
                template="plotly_white",
                color_discrete_sequence=['#FF6B6B']
            )
            st.plotly_chart(fig_hist, use_container_width=True)

        with col2:
            # パフォーマンスカテゴリの円グラフ
            if 'performance_category' in df.columns:
                category_counts = df['performance_category'].value_counts()
                fig_pie = px.pie(
                    values=category_counts.values,
                    names=category_counts.index,
                    title="パフォーマンスカテゴリ分布",
                    template="plotly_white",
                    color_discrete_sequence=px.colors.sequential.RdBu
                )
                st.plotly_chart(fig_pie, use_container_width=True)

    with tab3:
        # 相関分析
        fig_scatter = px.scatter(
            df,
            x='health_score',
            y='productivity_score',
            color='work_hours',
            size='work_hours',
            title="健康スコア vs 生産性スコア",
            labels={
                'health_score': '健康スコア',
                'productivity_score': '生産性スコア',
                'work_hours': '作業時間'
            },
            template="plotly_white",
            color_continuous_scale='Viridis'
        )

        # 回帰線を追加
        fig_scatter.add_trace(
            go.Scatter(
                x=df['health_score'],
                y=df['health_score'] * df['productivity_score'].corr(df['health_score']),
                mode='lines',
                name='トレンドライン',
                line=dict(color='red', dash='dash')
            )
        )

        st.plotly_chart(fig_scatter, use_container_width=True)

        # 相関係数表示
        correlation = df['health_score'].corr(df['productivity_score'])
        st.info(f"📊 健康スコアと生産性スコアの相関係数: {correlation:.3f}")

    # 週間サマリー
    st.markdown("### 📅 週間パフォーマンス")

    # 曜日別集計
    df['weekday'] = pd.to_datetime(df['date']).dt.day_name()
    weekday_avg = df.groupby('weekday').agg({
        'productivity_score': 'mean',
        'health_score': 'mean',
        'work_hours': 'mean'
    }).round(1)

    # 曜日の順序を設定
    weekday_order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    weekday_avg = weekday_avg.reindex(weekday_order)

    # ヒートマップ用データ準備
    heatmap_data = weekday_avg.T

    fig_heatmap = go.Figure(data=go.Heatmap(
        z=heatmap_data.values,
        x=heatmap_data.columns,
        y=heatmap_data.index,
        colorscale='RdYlGn',
        text=heatmap_data.values,
        texttemplate='%{text:.1f}',
        textfont={"size": 12},
        colorbar=dict(title="スコア")
    ))

    fig_heatmap.update_layout(
        title="曜日別パフォーマンスヒートマップ",
        xaxis_title="曜日",
        yaxis_title="メトリクス",
        height=300,
        template="plotly_white"
    )

    st.plotly_chart(fig_heatmap, use_container_width=True)

    # データテーブル（最新10件）
    with st.expander("📋 詳細データ（最新10件）"):
        display_columns = ['date', 'productivity_score', 'health_score', 'work_hours', 'sleep_hours', 'mood_level']
        display_df = df[display_columns].head(10)
        st.dataframe(
            display_df.style.format({
                'productivity_score': '{:.1f}',
                'health_score': '{:.1f}',
                'work_hours': '{:.1f}h',
                'sleep_hours': '{:.1f}h',
                'mood_level': '{:.1f}'
            }),
            use_container_width=True
        )

else:
    st.error("データの読み込みに失敗しました。設定を確認してください。")

# フッター
st.markdown("---")
st.markdown(
    """
    <div style='text-align: center; color: #666;'>
    ModerationCraft Analytics | Phase 3 Implementation | Built with Streamlit
    </div>
    """,
    unsafe_allow_html=True
)
