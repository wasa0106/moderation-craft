"""
健康相関分析ページ
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
from utils.mock_data import setup_mock_database

# ページ設定
st.set_page_config(
    page_title="健康相関分析 - ModerationCraft",
    page_icon="💤",
    layout="wide"
)

st.title("💤 健康相関分析")
st.markdown("睡眠・健康と生産性の相関を分析")

# サイドバー設定
with st.sidebar:
    st.header("💤 分析設定")
    
    # 分析期間
    analysis_period = st.slider(
        "分析期間（日数）",
        min_value=7,
        max_value=90,
        value=30,
        step=7
    )
    
    # 相関分析対象
    correlation_targets = st.multiselect(
        "相関分析対象",
        ["sleep_score", "health_score", "steps", "mood_level"],
        default=["sleep_score", "health_score"]
    )
    
    # 移動平均期間
    ma_window = st.selectbox(
        "移動平均期間",
        [3, 7, 14, 30],
        index=1
    )

# データ取得
conn = get_connection()

@st.cache_data(ttl=300)
def load_correlation_data(days: int):
    """相関分析用データを取得"""
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
        FROM mart_wellness_correlation
        WHERE date >= CURRENT_DATE - INTERVAL '{days} days'
        ORDER BY date DESC
    """
    
    try:
        df = run_query(query)
        if df.empty:
            setup_mock_database(conn)
            df = run_query(query)
        return df
    except:
        setup_mock_database(conn)
        # モックデータから取得
        query_simple = f"""
            SELECT * FROM mart_wellness_correlation
            WHERE date >= CURRENT_DATE - INTERVAL '{days} days'
            ORDER BY date DESC
        """
        return run_query(query_simple)

# データ読み込み
df = load_correlation_data(analysis_period)

if not df.empty:
    # 相関係数計算
    st.markdown("### 📊 相関係数マトリックス")
    
    # 相関マトリックス用のカラム選択
    correlation_cols = ['productivity_score'] + correlation_targets
    corr_matrix = df[correlation_cols].corr()
    
    # ヒートマップ
    fig_corr = go.Figure(data=go.Heatmap(
        z=corr_matrix.values,
        x=corr_matrix.columns,
        y=corr_matrix.columns,
        colorscale='RdBu',
        zmid=0,
        text=corr_matrix.values.round(3),
        texttemplate='%{text}',
        textfont={"size": 12},
        colorbar=dict(title="相関係数")
    ))
    
    fig_corr.update_layout(
        title="相関係数ヒートマップ",
        height=400,
        template="plotly_white"
    )
    
    st.plotly_chart(fig_corr, use_container_width=True)
    
    # 主要な相関の解釈
    col1, col2, col3 = st.columns(3)
    
    with col1:
        sleep_corr = corr_matrix.loc['productivity_score', 'sleep_score'] if 'sleep_score' in correlation_targets else 0
        st.metric(
            "睡眠×生産性",
            f"{sleep_corr:.3f}",
            help="睡眠スコアと生産性スコアの相関"
        )
    
    with col2:
        health_corr = corr_matrix.loc['productivity_score', 'health_score'] if 'health_score' in correlation_targets else 0
        st.metric(
            "健康×生産性",
            f"{health_corr:.3f}",
            help="健康スコアと生産性スコアの相関"
        )
    
    with col3:
        if 'mood_level' in correlation_targets and 'mood_level' in corr_matrix.columns:
            mood_corr = corr_matrix.loc['productivity_score', 'mood_level']
            st.metric(
                "気分×生産性",
                f"{mood_corr:.3f}",
                help="気分レベルと生産性スコアの相関"
            )
    
    # 散布図マトリックス
    st.markdown("### 🔍 相関散布図")
    
    tabs = st.tabs([t.replace('_', ' ').title() for t in correlation_targets])
    
    for i, target in enumerate(correlation_targets):
        with tabs[i]:
            col1, col2 = st.columns([2, 1])
            
            with col1:
                # 散布図
                fig_scatter = px.scatter(
                    df,
                    x=target,
                    y='productivity_score',
                    color='work_hours',
                    size='work_hours',
                    title=f"{target.replace('_', ' ').title()} vs 生産性スコア",
                    labels={
                        target: target.replace('_', ' ').title(),
                        'productivity_score': '生産性スコア',
                        'work_hours': '作業時間'
                    },
                    template="plotly_white",
                    trendline="ols",
                    color_continuous_scale='Viridis'
                )
                
                st.plotly_chart(fig_scatter, use_container_width=True)
            
            with col2:
                # 統計情報
                st.markdown("#### 📈 統計情報")
                
                # 相関係数と有意性検定
                if target in df.columns:
                    correlation, p_value = stats.pearsonr(
                        df[target].dropna(),
                        df['productivity_score'].dropna()
                    )
                    
                    st.metric("相関係数", f"{correlation:.3f}")
                    st.metric("p値", f"{p_value:.4f}")
                    
                    if p_value < 0.05:
                        st.success("✅ 統計的に有意")
                    else:
                        st.warning("⚠️ 統計的に有意でない")
                    
                    # 回帰係数
                    from sklearn.linear_model import LinearRegression
                    X = df[[target]].dropna()
                    y = df.loc[X.index, 'productivity_score']
                    
                    if len(X) > 0:
                        model = LinearRegression()
                        model.fit(X, y)
                        st.metric("回帰係数", f"{model.coef_[0]:.3f}")
                        st.metric("R²スコア", f"{model.score(X, y):.3f}")
    
    # 時系列相関分析
    st.markdown("### 📈 時系列相関トレンド")
    
    # 移動相関の計算
    df['sleep_prod_corr'] = df['sleep_score'].rolling(window=ma_window).corr(df['productivity_score'])
    df['health_prod_corr'] = df['health_score'].rolling(window=ma_window).corr(df['productivity_score'])
    
    fig_time_corr = go.Figure()
    
    fig_time_corr.add_trace(go.Scatter(
        x=df['date'],
        y=df['sleep_prod_corr'],
        mode='lines',
        name='睡眠×生産性',
        line=dict(color='#9B59B6', width=2)
    ))
    
    fig_time_corr.add_trace(go.Scatter(
        x=df['date'],
        y=df['health_prod_corr'],
        mode='lines',
        name='健康×生産性',
        line=dict(color='#3498DB', width=2)
    ))
    
    # 基準線を追加
    fig_time_corr.add_hline(y=0, line_dash="dash", line_color="gray", opacity=0.5)
    fig_time_corr.add_hline(y=0.5, line_dash="dot", line_color="green", opacity=0.3)
    fig_time_corr.add_hline(y=-0.5, line_dash="dot", line_color="red", opacity=0.3)
    
    fig_time_corr.update_layout(
        title=f"移動相関係数の推移（{ma_window}日間）",
        xaxis_title="日付",
        yaxis_title="相関係数",
        yaxis_range=[-1, 1],
        template="plotly_white",
        height=400,
        hovermode='x unified'
    )
    
    st.plotly_chart(fig_time_corr, use_container_width=True)
    
    # パターン分析
    st.markdown("### 🎯 相関パターン分析")
    
    if 'correlation_pattern' in df.columns:
        pattern_counts = df['correlation_pattern'].value_counts()
        
        col1, col2 = st.columns(2)
        
        with col1:
            # パターン分布
            fig_pattern = px.pie(
                values=pattern_counts.values,
                names=pattern_counts.index,
                title="相関パターンの分布",
                template="plotly_white",
                color_discrete_map={
                    'both_improving': '#2ECC71',
                    'both_declining': '#E74C3C',
                    'stable': '#95A5A6',
                    'mixed': '#F39C12'
                }
            )
            st.plotly_chart(fig_pattern, use_container_width=True)
        
        with col2:
            # パターン別の生産性
            pattern_productivity = df.groupby('correlation_pattern')['productivity_score'].mean()
            
            fig_pattern_prod = go.Figure(data=[
                go.Bar(
                    x=pattern_productivity.index,
                    y=pattern_productivity.values,
                    text=pattern_productivity.values.round(1),
                    textposition='auto',
                    marker_color=['#2ECC71', '#E74C3C', '#F39C12', '#95A5A6']
                )
            ])
            
            fig_pattern_prod.update_layout(
                title="パターン別平均生産性",
                xaxis_title="相関パターン",
                yaxis_title="平均生産性スコア",
                template="plotly_white"
            )
            
            st.plotly_chart(fig_pattern_prod, use_container_width=True)
    
    # 最適値分析
    st.markdown("### 🎯 最適値分析")
    
    # 睡眠時間の最適値
    if 'sleep_hours' in df.columns:
        sleep_bins = pd.cut(df['sleep_hours'], bins=[0, 5, 6, 7, 8, 9, 12])
        sleep_productivity = df.groupby(sleep_bins)['productivity_score'].mean()
        
        fig_optimal = go.Figure(data=[
            go.Bar(
                x=[str(b) for b in sleep_productivity.index],
                y=sleep_productivity.values,
                text=sleep_productivity.values.round(1),
                textposition='auto',
                marker_color='#8E44AD'
            )
        ])
        
        fig_optimal.update_layout(
            title="睡眠時間別の平均生産性",
            xaxis_title="睡眠時間（時間）",
            yaxis_title="平均生産性スコア",
            template="plotly_white",
            height=350
        )
        
        st.plotly_chart(fig_optimal, use_container_width=True)
        
        # 最適睡眠時間の推定
        optimal_sleep = sleep_productivity.idxmax()
        st.info(f"💡 最適な睡眠時間帯: {optimal_sleep}")

else:
    st.error("データの読み込みに失敗しました。")

# レコメンデーション
st.markdown("### 💡 改善提案")

if not df.empty:
    recommendations = []
    
    # 睡眠に関する提案
    if 'sleep_score' in df.columns:
        avg_sleep = df['sleep_score'].mean()
        if avg_sleep < 70:
            recommendations.append("🛏️ 睡眠の質を改善しましょう。規則正しい就寝時間を心がけてください。")
        
        # 睡眠と生産性の相関
        if 'sleep_score' in correlation_targets:
            sleep_corr = corr_matrix.loc['productivity_score', 'sleep_score']
            if sleep_corr > 0.5:
                recommendations.append("✅ 睡眠と生産性に強い正の相関があります。睡眠を優先することで生産性向上が期待できます。")
    
    # 健康に関する提案
    if 'health_score' in df.columns:
        health_trend = df['health_score'].iloc[0] - df['health_score'].iloc[-1] if len(df) > 1 else 0
        if health_trend < 0:
            recommendations.append("⚠️ 健康スコアが低下傾向です。運動や栄養バランスに注意しましょう。")
    
    # パターンに基づく提案
    if 'correlation_pattern' in df.columns:
        recent_pattern = df['correlation_pattern'].iloc[0]
        if recent_pattern == 'both_declining':
            recommendations.append("🚨 睡眠と生産性が両方低下しています。休息を優先してください。")
        elif recent_pattern == 'both_improving':
            recommendations.append("🎉 素晴らしい！睡眠と生産性が両方改善しています。この調子を維持しましょう。")
    
    for rec in recommendations:
        st.info(rec)