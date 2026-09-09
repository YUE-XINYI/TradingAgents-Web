import type { AnalysisEvent, AnalysisRun } from './trading-api';

export type UserProfile = {
  explanationPreference: string;
  typicalHorizon: string;
  focus: string;
  terminology: string;
  personalizationEnabled: boolean;
  historyEnabled: boolean;
};

export type WatchlistItem = {
  ticker: string;
  name: string;
  reason: string;
  status: string;
  hasDemo?: boolean;
};

export const DEFAULT_PROFILE: UserProfile = {
  explanationPreference: '先结论，后依据',
  typicalHorizon: '中长期（6–24 个月）',
  focus: '基本面与下行风险',
  terminology: '首次出现时解释',
  personalizationEnabled: true,
  historyEnabled: true,
};

export const DEMO_WATCHLIST: WatchlistItem[] = [
  {
    ticker: 'NVDA',
    name: 'NVIDIA',
    reason: '持续关注 AI 算力与新产品周期',
    status: '有一份预置案例',
    hasDemo: true,
  },
  {
    ticker: '0700.HK',
    name: '腾讯控股',
    reason: '关注游戏、广告与云业务恢复',
    status: '最近浏览',
  },
  {
    ticker: 'AAPL',
    name: 'Apple',
    reason: '关注换机周期与服务业务',
    status: '等待更新',
  },
];

export const DEMO_RECENT_VIEWS = [
  { ticker: '0700.HK', topic: '财报后的利润质量', time: '今天 19:42' },
  { ticker: 'NVDA', topic: '增长预期与估值风险', time: '昨天 22:16' },
  { ticker: 'AAPL', topic: '产品周期是否改善', time: '9 月 6 日' },
];

export const DEMO_EVENTS: AnalysisEvent[] = [
  {
    id: 1,
    kind: 'status',
    stage: 'data',
    title: '数据范围已确认',
    detail: '行情、公司资料与事件窗口已就绪',
    content: '',
    timestamp: '2025-02-27T09:00:00Z',
  },
  {
    id: 2,
    kind: 'progress',
    stage: 'analysts',
    title: '市场分析师完成',
    detail: '趋势、成交与波动证据已整理',
    content: '',
    timestamp: '2025-02-27T09:01:00Z',
  },
  {
    id: 3,
    kind: 'progress',
    stage: 'analysts',
    title: '基本面分析师完成',
    detail: '增长驱动与盈利质量已整理',
    content: '',
    timestamp: '2025-02-27T09:02:00Z',
  },
  {
    id: 4,
    kind: 'progress',
    stage: 'analysts',
    title: '新闻与情绪分析师完成',
    detail: '重要事件与市场预期已交叉检查',
    content: '',
    timestamp: '2025-02-27T09:03:00Z',
  },
  {
    id: 5,
    kind: 'progress',
    stage: 'debate',
    title: '多空研究完成交叉质询',
    detail: '增长逻辑与估值风险已形成分歧',
    content: '',
    timestamp: '2025-02-27T09:04:00Z',
  },
  {
    id: 6,
    kind: 'progress',
    stage: 'trader',
    title: '交易员形成条件化方案',
    detail: '未将研究结论转成无条件买卖指令',
    content: '',
    timestamp: '2025-02-27T09:05:00Z',
  },
  {
    id: 7,
    kind: 'progress',
    stage: 'risk',
    title: '风险团队完成压力测试',
    detail: '需求、估值与政策情景已讨论',
    content: '',
    timestamp: '2025-02-27T09:06:00Z',
  },
  {
    id: 8,
    kind: 'progress',
    stage: 'portfolio',
    title: '投资组合经理完成裁决',
    detail: '建议保持观察，并明确重新评估条件',
    content: '',
    timestamp: '2025-02-27T09:07:00Z',
  },
  {
    id: 9,
    kind: 'complete',
    stage: 'complete',
    title: '案例分析完成',
    detail: '所有内容仅用于展示产品交互，不代表当前行情',
    content: '',
    timestamp: '2025-02-27T09:08:00Z',
  },
];

export const DEMO_RUN: AnalysisRun = {
  id: 'demo-nvda-case',
  ticker: 'NVDA',
  analysis_date: '2025-02-27',
  depth: 'standard',
  cognitive_mode: 'intermediate',
  analysts: ['market', 'social', 'news', 'fundamentals'],
  status: 'completed',
  signal: 'HOLD · 条件观察',
  created_at: '2025-02-27T09:00:00Z',
  updated_at: '2025-02-27T09:08:00Z',
  events: DEMO_EVENTS,
  report: {
    ticker: 'NVDA',
    analysis_date: '2025-02-27',
    signal: 'HOLD · 条件观察',
    assistant_brief:
      '先说结论：这份案例报告没有支持“看到增长就立即买入”的简单判断。AI 算力需求与产品竞争力构成支持证据，但高预期、盈利质量变化和政策不确定性构成反面证据。是否采取行动，还取决于你的持有周期、已有仓位和可承受波动。',
    summary:
      '组合经理裁决：保持观察（HOLD）。\n\n已确认：案例材料显示公司仍处于 AI 算力需求扩张的核心环节，数据中心业务是主要增长驱动；同时，新产品爬坡、客户集中与外部政策会影响盈利兑现。\n\n推断：如果需求和盈利质量继续兑现，当前高预期可能得到支撑；如果增速、毛利率或订单能见度弱于预期，估值压缩可能放大回撤。\n\n未知：下一阶段真实需求持续性、客户资本开支节奏及政策影响仍需新数据确认。\n\n失效条件：后续财报显示需求或盈利质量显著偏离当前假设时，必须重新分析。',
    sections: {
      market:
        '【事实｜案例材料】分析窗口内价格仍处于中期强势区间，但财报与新品节点附近波动明显放大。\n\n【推断】趋势仍有支撑，不代表短期不会回撤；若价格上涨而成交与基本面验证减弱，趋势信号的可靠性会下降。\n\n【失效条件】跌破关键趋势区间并伴随持续放量，需重新评估市场结构。',
      fundamentals:
        '【事实｜案例材料】数据中心相关需求是增长的主要驱动，公司拥有软硬件生态优势；新一代产品爬坡会影响成本和盈利质量。\n\n【推断】竞争优势可以支撑增长，但当前预期要求未来多个季度继续兑现。\n\n【相反证据】客户自研芯片、竞争对手追赶、客户集中和毛利率波动可能削弱增长质量。',
      news:
        '【事实｜案例材料】市场关注新产品交付、云厂商资本开支和外部政策变化。\n\n【相关性判断】直接影响订单、供给或可销售市场的事件优先级高；重复转载和无新增事实的情绪化标题被降权。',
      sentiment:
        '【事实｜案例材料】市场讨论热度较高，观点明显分化。\n\n【边界】讨论热度只能反映预期拥挤度，不能作为未来价格一定上涨或下跌的证据。',
      bull_bear:
        '多头：AI 基础设施投入仍有结构性需求，生态壁垒和产品迭代可能继续带来增长。\n\n空头：高增长已被广泛预期，任何需求、交付或盈利质量不及预期都可能触发估值收缩。\n\n关键分歧：未来需求是持续扩张，还是资本开支提前释放后的放缓。',
      research_verdict:
        '研究经理：支持逻辑和反面风险同时成立，不使用单一事件直接得出买卖结论。后续重点核验订单能见度、客户资本开支和盈利质量。',
      trader_plan:
        '交易员：当前仅给出条件化方案。未持有用户应先确认投资周期和可承受波动；已有仓位用户还需提供成本与集中度。信息不足时维持观察，不生成仓位指令。',
      risk_debate:
        '激进视角强调增长兑现带来的上行弹性；中性视角建议等待新数据并控制单一情景依赖；保守视角强调高预期下的回撤放大、客户集中与政策风险。',
      risk_verdict:
        '风险裁决：置信度为中等。原因是增长证据存在，但估值、需求持续性和外部政策仍有重要未知。结论只在本案例数据窗口内有效。',
    },
  },
};

export const DEMO_AGENT_REPLIES: Record<string, string> = {
  fundamentals:
    '角色视角：基本面分析师\n已确认事实：案例报告显示，数据中心需求是主要增长驱动，软硬件生态构成竞争优势。\n分析推断：优势能否支撑当前预期，取决于未来几个季度的需求和盈利质量。\n相反证据：客户自研、竞争加剧和毛利率波动可能削弱增长质量。\n失效条件：订单能见度或盈利质量连续弱于当前假设。\n置信度：中等。',
  market:
    '角色视角：市场分析师\n已确认事实：案例窗口内中期趋势偏强，事件节点附近波动放大。\n分析推断：趋势提供支撑，但不能证明当前位置适合立即买入。\n相反证据：高位放量回撤会削弱趋势结构。\n失效条件：关键趋势区间被持续跌破。\n置信度：中等。',
  sentiment:
    '角色视角：情绪分析师\n已确认事实：讨论热度高且观点分化。\n分析推断：拥挤预期可能放大短期波动。\n相反证据：热度不是基本面，也不能预测方向。\n失效条件：出现新的订单或财务事实后，应以新事实替代旧情绪。\n置信度：较低。',
  news:
    '角色视角：新闻分析师\n已确认事实：产品交付、云厂商资本开支和政策变化是高相关事件。\n分析推断：只有能改变订单、供给或可销售市场的新闻，才可能改变投资逻辑。\n相反证据：重复转载和无新增事实的标题不构成新证据。\n失效条件：出现正式公告或新财报。\n置信度：中等。',
  research:
    '角色视角：研究员（后台综合多头、空头与研究经理）\n支持逻辑：AI 基础设施投入、生态壁垒和产品迭代仍构成上行逻辑。\n反对逻辑：高增长已被广泛预期，需求、交付或盈利质量不及预期可能触发估值收缩。\n核心分歧：未来需求是持续扩张，还是资本开支提前释放后的放缓。\n研究结论：当前最重要的不是选边，而是继续验证需求持续性与盈利质量。\n失效条件：订单和盈利质量明显改变。\n置信度：中等。',
  trader:
    '角色视角：交易员\n方案：信息不足时不生成仓位指令。未持有需要先确认周期与可承受波动；已持有还要补充成本和集中度。\n风险：用公司优秀直接替代价格与风险判断。\n下一步：补充你的持仓状态。',
  risk:
    '角色视角：风险分析师（后台综合激进、中性与保守情景）\n乐观情景：增长持续超预期，上行弹性仍可能存在。\n基准情景：增长证据存在，但回报风险比依赖后续兑现，应等待新数据分阶段验证。\n保守情景：高预期放大不及预期时的回撤，客户集中与政策风险难由公司控制。\n最大下行风险：需求和盈利质量同时转弱。\n风险结论：没有明确周期和风险边界前，不给出直接买入结论。',
  portfolio_manager:
    '角色视角：投资组合经理\n最终裁决：HOLD／条件观察。\n依据：增长优势与估值、政策风险同时存在，证据不足以支持无条件行动。\n重新评估：下一次财报、订单与盈利质量更新后。\n置信度：中等。',
  personal:
    '结合你的偏好，我先用一句话总结：这不是“公司好所以立刻买”的问题，而是未来增长能否继续高于已经很高的预期。\n\n已确认事实：增长驱动和竞争优势存在。\n关键分歧：多头相信需求持续，空头担心高预期与盈利质量。\n仍然未知：你的持仓状态、计划持有多久、能承受多大波动。\n失效条件：后续需求或盈利质量明显偏离当前假设。\n\n在给出更贴合你的条件化判断前，请先告诉我：你现在是否持有，计划持有多久？',
};
