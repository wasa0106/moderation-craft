"""
生産性分析ページ
"""
import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import numpy as np
from datetime import datetime, timedelta
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils.database import get_connection, run_query
from utils.mock_data import setup_mock_database

# ページ設定
st.set_page_config(
    page_title="生産性分析 - ModerationCraft",
    page_icon="📊",
    layout="wide"
)

st.title("📊 生産性分析")
st.markdown("作業パターンと生産性の詳細分析")

# サイドバー設定
with st.sidebar:
    st.header("📊 分析設定")
    
    # 期間選択
    period = st.selectbox(
        "集計期間",
        ["日次", "週次", "月次"],
        index=0
    )
    
    # 日付範囲
    days_range = st.slider(
        "表示期間（日数）",
        min_value=7,
        max_value=180,
        value=30,
        step=7
    )
    
    # メトリクス選択
    metrics = st.multiselect(
        "表示メトリクス",
        ["productivity_score", "work_hours", "work_sessions", "pomodoro_rate", "mood_level"],
        default=["productivity_score", "work_hours"]
    )

# データ取得
conn = get_connection()

@st.cache_data(ttl=300)
def load_productivity_data(days: int, period: str):
    """生産性データを取得"""
    
    # 期間に応じた集計
    if period == "日次":
        date_format = "date"
        group_by = "date"
    elif period == "週次":
        date_format = "DATE_TRUNC('week', date)"
        group_by = "DATE_TRUNC('week', date)"
    else:  # 月次
        date_format = "DATE_TRUNC('month', date)"
        group_by = "DATE_TRUNC('month', date)"
    
    query = f"""
        SELECT 
            {date_format} as period,
            AVG(productivity_score) as productivity_score,
            AVG(work_hours) as work_hours,
            AVG(work_sessions) as work_sessions,
            AVG(pomodoro_rate) as pomodoro_rate,
            AVG(mood_level) as mood_level,
            COUNT(*) as data_points
        FROM mart_productivity_daily
        WHERE date >= CURRENT_DATE - INTERVAL '{days} days'
        GROUP BY {group_by}
        ORDER BY period DESC
    """
    
    try:
        df = run_query(query)
        if df.empty:
            setup_mock_database(conn)
            df = run_query(query)
        return df
    except:
        setup_mock_database(conn)
        return run_query(query)

# データ読み込み
df = load_productivity_data(days_range, period)

if not df.empty:
    # サマリー統計
    st.markdown("### 📈 サマリー統計")
    
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        avg_productivity = df['productivity_score'].mean()
        st.metric(
            "平均生産性スコア",
            f"{avg_productivity:.1f}",
            help=f"{period}平均"
        )
    
    with col2:
        max_productivity = df['productivity_score'].max()
        st.metric(
            "最高生産性スコア",
            f"{max_productivity:.1f}",
            help=f"{period}最高値"
        )
    
    with col3:
        avg_work = df['work_hours'].mean()
        st.metric(
            "平均作業時間",
            f"{avg_work:.1f}h",
            help=f"{period}平均"
        )
    
    with col4:
        trend = df['productivity_score'].iloc[0] - df['productivity_score'].iloc[-1] if len(df) > 1 else 0
        st.metric(
            "トレンド",
            f"{trend:+.1f}",
            help="期間中の変化"
        )
    
    # メイングラフ
    st.markdown("### 📊 生産性トレンド")
    
    # 複数メトリクスのグラフ
    fig = make_subplots(
        rows=len(metrics),
        cols=1,
        subplot_titles=[m.replace('_', ' ').title() for m in metrics],
        shared_xaxes=True,
        vertical_spacing=0.1
    )
    
    colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7']
    
    for i, metric in enumerate(metrics, 1):
        fig.add_trace(
            go.Scatter(
                x=df['period'],
                y=df[metric],
                mode='lines+markers',
                name=metric.replace('_', ' ').title(),
                line=dict(color=colors[i-1], width=2),
                marker=dict(size=8),
                showlegend=False
            ),
            row=i,
            col=1
        )
        
        # 移動平均を追加
        if len(df) > 3:
            window = min(3, len(df))
            ma = df[metric].rolling(window=window).mean()
            fig.add_trace(
                go.Scatter(
                    x=df['period'],
                    y=ma,
                    mode='lines',
                    name=f'MA({window})',
                    line=dict(color=colors[i-1], width=1, dash='dash'),
                    opacity=0.5,
                    showlegend=False
                ),
                row=i,
                col=1
            )
    
    fig.update_layout(
        height=200 * len(metrics),
        template="plotly_white",
        hovermode='x unified'
    )
    
    st.plotly_chart(fig, use_container_width=True)
    
    # 時間帯分析
    st.markdown("### ⏰ 時間帯別分析")
    
    # 時間帯別の模擬データ（実際のデータがない場合）
    time_slots = ['早朝', '午前', '午後', '夕方', '夜']
    time_productivity = [60, 85, 90, 75, 65]
    time_sessions = [1, 3, 4, 3, 2]
    
    col1, col2 = st.columns(2)
    
    with col1:
        fig_time = go.Figure(data=[
            go.Bar(
                x=time_slots,
                y=time_productivity,
                text=time_productivity,
                textposition='auto',
                marker_color='#FF6B6B'
            )
        ])
        
        fig_time.update_layout(
            title="時間帯別生産性スコア",
            xaxis_title="時間帯",
            yaxis_title="生産性スコア",
            template="plotly_white",
            height=350
        )
        
        st.plotly_chart(fig_time, use_container_width=True)
    
    with col2:
        fig_sessions = go.Figure(data=[
            go.Bar(
                x=time_slots,
                y=time_sessions,
                text=time_sessions,
                textposition='auto',
                marker_color='#4ECDC4'
            )
        ])
        
        fig_sessions.update_layout(
            title="時間帯別セッション数",
            xaxis_title="時間帯",
            yaxis_title="セッション数",
            template="plotly_white",
            height=350
        )
        
        st.plotly_chart(fig_sessions, use_container_width=True)
    
    # ポモドーロ分析
    st.markdown("### 🍅 ポモドーロテクニック分析")
    
    col1, col2 = st.columns(2)
    
    with col1:
        # ポモドーロ準拠率の分布
        if 'pomodoro_rate' in df.columns:
            fig_pomo = px.histogram(
                df,
                x='pomodoro_rate',
                nbins=20,
                title="ポモドーロ準拠率の分布",
                labels={'pomodoro_rate': '準拠率 (%)', 'count': '頻度'},
                template="plotly_white",
                color_discrete_sequence=['#FFA07A']
            )
            st.plotly_chart(fig_pomo, use_container_width=True)
    
    with col2:
        # ポモドーロと生産性の関係
        if 'pomodoro_rate' in df.columns and 'productivity_score' in df.columns:
            fig_pomo_prod = px.scatter(
                df,
                x='pomodoro_rate',
                y='productivity_score',
                title="ポモドーロ準拠率 vs 生産性",
                labels={
                    'pomodoro_rate': 'ポモドーロ準拠率 (%)',
                    'productivity_score': '生産性スコア'
                },
                template="plotly_white",
                trendline="ols",
                color_discrete_sequence=['#FFD700']
            )
            st.plotly_chart(fig_pomo_prod, use_container_width=True)
    
    # 詳細データテーブル
    with st.expander("📋 詳細データ"):
        st.dataframe(
            df.style.format({
                'productivity_score': '{:.1f}',
                'work_hours': '{:.1f}h',
                'work_sessions': '{:.0f}',
                'pomodoro_rate': '{:.1f}%',
                'mood_level': '{:.1f}'
            }),
            use_container_width=True
        )
        
        # CSVダウンロードボタン
        csv = df.to_csv(index=False)
        st.download_button(
            label="📥 CSVダウンロード",
            data=csv,
            file_name=f"productivity_analysis_{datetime.now().strftime('%Y%m%d')}.csv",
            mime="text/csv"
        )

else:
    st.error("データの読み込みに失敗しました。")

# インサイト生成
st.markdown("### 💡 インサイト")

if not df.empty:
    insights = []
    
    # 生産性トレンド
    if len(df) > 1:
        trend = (df['productivity_score'].iloc[0] - df['productivity_score'].iloc[-1]) / len(df)
        if trend > 0:
            insights.append(f"✅ 生産性は改善傾向にあります（+{trend:.2f}/期間）")
        elif trend < 0:
            insights.append(f"⚠️ 生産性は低下傾向にあります（{trend:.2f}/期間）")
        else:
            insights.append("➡️ 生産性は安定しています")
    
    # 作業時間
    avg_work = df['work_hours'].mean()
    if avg_work > 8:
        insights.append(f"⚠️ 平均作業時間が長めです（{avg_work:.1f}時間）。適度な休憩を心がけましょう")
    elif avg_work < 4:
        insights.append(f"💡 作業時間が短めです（{avg_work:.1f}時間）。集中的な作業を試してみましょう")
    else:
        insights.append(f"✅ 作業時間は適切な範囲です（{avg_work:.1f}時間）")
    
    # ポモドーロ
    if 'pomodoro_rate' in df.columns:
        avg_pomo = df['pomodoro_rate'].mean()
        if avg_pomo > 80:
            insights.append(f"🍅 ポモドーロテクニックの実践率が高いです（{avg_pomo:.1f}%）")
        elif avg_pomo < 50:
            insights.append(f"💡 ポモドーロテクニックをもっと活用してみましょう（現在{avg_pomo:.1f}%）")
    
    for insight in insights:
        st.info(insight)