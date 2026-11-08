/*
 * @Author: zhengrenfu
 * @Date: 2026-11-08 17:35:00
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-08 17:35:00
 * @FilePath: \src\types\chart.ts
 * @Description: 统计图表类型定义，各图表组件与统计弹窗共用
 */

// #region 图表区间

/** 统计图表的查询区间，calendar 为日历组件的展示范围 */
export interface StatsRange {
  start: string
  end: string
  calendar: number | string
}

// #endregion

// #region 图表数据

/** 矩阵树形图的一项：项目名与任务数 */
export interface ProjectShareItem {
  name: string
  value: number
}

/** 趋势图的一条项目线 */
export interface TrendSeries {
  name: string
  values: number[]
}

/** 趋势图的完整数据 */
export interface TrendData {
  dates: string[]
  series: TrendSeries[]
}

/** 每日工时热力图的一项，value 为 [日期, 小时数] */
export interface DailyHoursItem {
  value: [string, number]
  itemStyle: { color: string }
}

/** 与上期对比明细的一行 */
export interface CompareDetailRow {
  label: string
  prev: string | number
  curr: string | number
  // 无法计算环比时为 null
  growth: number | null
}

/** 与上期对比柱状图的一项 */
export interface CompareChartItem {
  label: string
  prev: number
  curr: number
}

// #endregion
