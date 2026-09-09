'use client';

import { SubmitEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bookmark,
  BrainCircuit,
  ChartNoAxesCombined,
  Check,
  ChevronRight,
  Clock3,
  Eye,
  Gauge,
  History,
  LayoutDashboard,
  LoaderCircle,
  MessageSquareMore,
  Moon,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  UserRound,
  Users,
  XCircle,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import {
  API_BASE,
  AnalysisEvent,
  AnalysisRun,
  AppView,
  CognitiveMode,
  tradingApi,
} from '@/lib/trading-api';
import {
  DEFAULT_PROFILE,
  DEMO_AGENT_REPLIES,
  DEMO_EVENTS,
  DEMO_RECENT_VIEWS,
  DEMO_RUN,
  DEMO_WATCHLIST,
  type UserProfile,
} from '@/lib/demo-data';

const navItems: { id: AppView; label: string; icon: typeof LayoutDashboard }[] =
  [
    { id: 'dashboard', label: '今日工作台', icon: LayoutDashboard },
    { id: 'history', label: '分析记录', icon: ChartNoAxesCombined },
    { id: 'chat', label: 'Agent 协作室', icon: MessageSquareMore },
    { id: 'profile', label: '我的投研', icon: UserRound },
  ];

const agentRail = [
  {
    name: '市场数据',
    role: '行情快照',
    icon: Activity,
    tone: 'blue',
    stage: 'data',
  },
  {
    name: '分析师团队',
    role: '四路研究',
    icon: Users,
    tone: 'blue',
    stage: 'analysts',
  },
  {
    name: '多空研究员',
    role: '交叉质询',
    icon: MessageSquareMore,
    tone: 'copper',
    stage: 'debate',
  },
  {
    name: '风险团队',
    role: '压力测试',
    icon: ShieldCheck,
    tone: 'green',
    stage: 'risk',
  },
  {
    name: '组合经理',
    role: '最终裁决',
    icon: Gauge,
    tone: 'ink',
    stage: 'portfolio',
  },
];

const stageProgress: Record<string, number> = {
  queued: 4,
  data: 12,
  analysts: 42,
  debate: 62,
  trader: 74,
  risk: 88,
  portfolio: 96,
  complete: 100,
  error: 100,
};
const sectionLabels: Record<string, string> = {
  market: '市场与技术',
  fundamentals: '基本面',
  news: '新闻',
  sentiment: '市场情绪',
  bull_bear: '多空辩论',
  research_verdict: '研究经理结论',
  trader_plan: '交易计划',
  risk_debate: '风险辩论',
  risk_verdict: '风险裁决',
};
const agentLabels: Record<string, string> = {
  personal: '个人助手',
  market: '市场分析师',
  sentiment: '情绪分析师',
  news: '新闻分析师',
  fundamentals: '基本面分析师',
  research: '研究员',
  trader: '交易员',
  risk: '风险分析师',
  portfolio_manager: '投资组合经理',
};
const chatAgentIds = [
  'personal',
  'market',
  'sentiment',
  'news',
  'fundamentals',
  'research',
  'trader',
  'risk',
  'portfolio_manager',
] as const;
type ChatAgentId = (typeof chatAgentIds)[number];
type ChatChannelId = 'group' | ChatAgentId;
type ChatMessage = {
  role: 'user' | 'assistant';
  agent?: ChatAgentId;
  content: string;
  runId?: string;
};
const demoGroupConversation: ChatMessage[] = [
  {
    role: 'user',
    content: 'NVDA 最近上涨主要由什么驱动？',
  },
  {
    role: 'assistant',
    agent: 'market',
    content:
      '【事实｜案例窗口】中期趋势偏强，财报与新品节点附近的波动明显放大。\n【边界】价格上涨只能说明当时的市场预期增强，不能证明未来一定继续上涨。',
  },
  {
    role: 'assistant',
    agent: 'news',
    content:
      '【事实｜案例材料】新产品交付、云厂商资本开支与外部政策，是与订单和可销售市场最相关的三类事件。重复转载和没有新增事实的情绪化标题不作为新证据。',
  },
  {
    role: 'assistant',
    agent: 'personal',
    content:
      '先用一句话总结：案例窗口内的上涨由 AI 算力需求预期、产品周期和市场趋势共同推动。\n\n已确认事实：增长驱动和中期强势趋势有案例材料支持。\n分析推断：这些因素还能持续多久，需要后续订单、资本开支和盈利质量验证。\n仍然未知：当前案例不代表今天的实时行情。',
  },
  {
    role: 'user',
    content: '结合这份报告，现在适合买入吗？',
  },
  {
    role: 'assistant',
    agent: 'research',
    content:
      '支持逻辑：AI 基础设施投入、生态壁垒和产品迭代仍构成上行依据。\n反对逻辑：高增长已经被广泛预期，需求、交付或盈利质量不及预期可能触发估值收缩。\n研究结论：现有证据支持继续观察，不支持把“公司优秀”直接等同于“当前位置应买入”。',
  },
  {
    role: 'assistant',
    agent: 'trader',
    content:
      '我不会在缺少个人约束时生成仓位指令。未持有需要先确认投资周期和可承受波动；已经持有还需要补充成本、仓位集中度与计划退出条件。',
  },
  {
    role: 'assistant',
    agent: 'risk',
    content:
      '乐观情景：增长持续超预期，上行弹性仍在。\n基准情景：增长成立，但需要等待新数据逐步验证。\n保守情景：高预期放大业绩不及预期时的回撤。\n风险结论：在周期和风险边界未知时，不给出直接买入结论。',
  },
  {
    role: 'assistant',
    agent: 'portfolio_manager',
    content:
      '当前裁决：HOLD／条件观察。增长优势与估值、政策风险同时存在，证据不足以支持无条件行动；应在下一次财报、订单和盈利质量更新后重新评估。',
  },
  {
    role: 'assistant',
    agent: 'personal',
    content:
      '所以，“现在该不该买”还不能只凭这份报告回答。报告给出的专业判断是条件观察，不是对你的个人买卖指令。\n\n请你先确认三件事：现在是否持有、计划持有多久、最多能接受多大回撤？',
  },
  {
    role: 'user',
    content: '哪些情况会让当前判断失效？',
  },
  {
    role: 'assistant',
    agent: 'risk',
    content:
      '重点监控三类失效信号：①订单能见度或客户资本开支持续转弱；②毛利率与盈利质量明显低于当前假设；③政策变化实质压缩可销售市场。任一项出现，都需要重新运行分析。',
  },
  {
    role: 'assistant',
    agent: 'personal',
    content:
      '你可以把失效条件记成一张观察清单：需求有没有转弱、利润质量有没有恶化、外部政策有没有改变市场空间。它们是重新评估的触发器，不是预测价格一定下跌。',
  },
];
const agentDescriptions: Record<ChatAgentId, string> = {
  personal: '理解你的关注点并组织结论',
  market: '价格趋势、成交与技术指标',
  sentiment: '市场讨论、预期与情绪边界',
  news: '公司新闻、公告与宏观事件',
  fundamentals: '财务、业务与长期竞争力',
  research: '呈现支持、反对、分歧与研究结论',
  trader: '把研究判断转为条件化方案',
  risk: '汇总乐观、基准与保守风险情景',
  portfolio_manager: '综合交易方案与风险裁决',
};
const agentAvatarStyles: Record<ChatAgentId, string> = {
  personal: 'bg-primary text-white',
  market: 'bg-[#E8F7F7] text-[#168C91] dark:bg-[#123D3F]',
  sentiment: 'bg-[#FFF6E5] text-[#A86E00] dark:bg-[#5C3B00]',
  news: 'bg-[#E9F1FD] text-[#2470EB] dark:bg-[#17345E]',
  fundamentals: 'bg-[#E9F1FD] text-[#2470EB] dark:bg-[#17345E]',
  research: 'bg-[#FFF1F1] text-[#D94747] dark:bg-[#641F24]',
  trader: 'bg-[#E9F1FD] text-[#194FA6] dark:bg-[#17345E]',
  risk: 'bg-[#FFF6E5] text-[#A86E00] dark:bg-[#5C3B00]',
  portfolio_manager:
    'bg-[#252525] text-white dark:bg-white dark:text-[#080808]',
};

function formatTime(value?: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function signalTone(signal?: string) {
  const normalized = signal?.toLowerCase() ?? '';
  if (normalized.includes('buy') || normalized.includes('overweight'))
    return 'positive';
  if (normalized.includes('sell') || normalized.includes('underweight'))
    return 'negative';
  return 'neutral';
}

function routedAgents(message: string): ChatAgentId[] {
  const normalized = message.toLowerCase();
  if (/买|卖|持有|仓位|入场|退出|buy|sell|hold/.test(normalized)) {
    return [
      'fundamentals',
      'market',
      'research',
      'trader',
      'risk',
      'portfolio_manager',
      'personal',
    ];
  }
  if (/风险|回撤|亏损|波动/.test(normalized)) {
    return ['risk', 'portfolio_manager', 'personal'];
  }
  if (/新闻|公告|消息|为什么|涨|跌/.test(normalized)) {
    return ['market', 'news', 'fundamentals', 'sentiment', 'personal'];
  }
  return ['fundamentals', 'market', 'research', 'personal'];
}

function profileContext(profile: UserProfile) {
  if (!profile.personalizationEnabled) return '用户已关闭个性化解释。';
  return `解释方式：${profile.explanationPreference}；常用周期：${profile.typicalHorizon}；关注重点：${profile.focus}；术语偏好：${profile.terminology}。画像只用于调整表达，不得改变事实、证据权重或结论。`;
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-[280px] place-items-center rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
      <div>
        <div className="mx-auto grid size-11 place-items-center rounded-xl bg-muted">
          <BookOpen className="size-5 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-sm font-semibold">{title}</h3>
        <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-muted-foreground">
          {description}
        </p>
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}

export function TradingApp() {
  const [view, setView] = useState<AppView>('dashboard');
  // 保留为后端兼容字段，不再向用户展示认知等级标签。
  const [mode, setMode] = useState<CognitiveMode>('intermediate');
  const [ticker, setTicker] = useState('NVDA');
  const [analysisDate, setAnalysisDate] = useState('2026-09-04');
  const [depth, setDepth] = useState('standard');
  const [focus, setFocus] = useState('综合判断');
  const [health, setHealth] = useState<{
    status: string;
    provider: string;
    api_key_configured: boolean;
  } | null>(null);
  const [runs, setRuns] = useState<AnalysisRun[]>([DEMO_RUN]);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [activeRun, setActiveRun] = useState<AnalysisRun | null>(DEMO_RUN);
  const [events, setEvents] = useState<AnalysisEvent[]>(DEMO_EVENTS);
  const [chatThreads, setChatThreads] = useState<
    Record<ChatChannelId, ChatMessage[]>
  >({
    group: [],
    personal: [],
    market: [],
    sentiment: [],
    news: [],
    fundamentals: [],
    research: [],
    trader: [],
    risk: [],
    portfolio_manager: [],
  });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const refreshData = useCallback(async () => {
    const [healthResult, runsResult] = await Promise.allSettled([
      tradingApi.health(),
      tradingApi.runs(),
    ]);
    if (healthResult.status === 'fulfilled') setHealth(healthResult.value);
    if (runsResult.status === 'fulfilled') {
      setRuns([
        DEMO_RUN,
        ...runsResult.value.filter((run) => run.id !== DEMO_RUN.id),
      ]);
    }
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refreshData(), 0);
    return () => {
      window.clearTimeout(initialRefresh);
      eventSourceRef.current?.close();
    };
  }, [refreshData]);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const openRun = useCallback(async (id: string) => {
    if (id === DEMO_RUN.id) {
      setActiveRun(DEMO_RUN);
      setEvents(DEMO_EVENTS);
      setMode('intermediate');
      setView('run');
      return;
    }
    const run = await tradingApi.run(id);
    setActiveRun(run);
    setEvents(run.events ?? []);
    setMode(run.cognitive_mode);
    setView('run');
  }, []);

  const openDemo = useCallback(() => {
    setTicker(DEMO_RUN.ticker);
    setActiveRun(DEMO_RUN);
    setEvents(DEMO_EVENTS);
    setMode('intermediate');
    setView('run');
  }, []);

  const attachStream = useCallback(
    (runId: string) => {
      eventSourceRef.current?.close();
      const source = new EventSource(`${API_BASE}/api/runs/${runId}/events`);
      eventSourceRef.current = source;
      source.onmessage = async (message) => {
        const event = JSON.parse(message.data) as AnalysisEvent;
        setEvents((current) =>
          current.some((item) => item.id === event.id)
            ? current
            : [...current, event],
        );
        if (event.kind === 'complete' || event.kind === 'error') {
          source.close();
          const run = await tradingApi.run(runId);
          setActiveRun(run);
          setBusy(false);
          void refreshData();
        }
      };
      source.onerror = () => {
        source.close();
        setBusy(false);
      };
    },
    [refreshData],
  );

  async function startAnalysis(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setBusy(true);
    setEvents([]);
    try {
      const result = await tradingApi.createRun({
        ticker,
        analysis_date: analysisDate,
        depth,
        cognitive_mode: mode,
        analysts:
          focus === '趋势与技术面'
            ? ['market', 'news']
            : focus === '估值与基本面'
              ? ['fundamentals', 'news']
              : ['market', 'social', 'news', 'fundamentals'],
      });
      setActiveRun({
        id: result.id,
        ticker,
        analysis_date: analysisDate,
        depth,
        cognitive_mode: mode,
        analysts: [],
        status: 'queued',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      setView('run');
      attachStream(result.id);
    } catch (error) {
      setBusy(false);
      setNotice(error instanceof Error ? error.message : '无法创建分析任务');
    }
  }

  const activeStage =
    events.at(-1)?.stage ??
    (activeRun?.status === 'completed' ? 'complete' : 'queued');
  const progress = stageProgress[activeStage] ?? 8;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Header
        health={health}
        darkMode={darkMode}
        onToggleTheme={() => setDarkMode((value) => !value)}
      />
      <div className="mx-auto grid max-w-[1600px] grid-cols-1 md:grid-cols-[210px_minmax(0,1fr)]">
        <Sidebar view={view} onNavigate={setView} />
        <section className="min-w-0 px-4 pb-24 pt-6 sm:px-6 md:pb-8 lg:px-8">
          {notice && (
            <div
              role="alert"
              className="mx-auto mb-4 max-w-[1120px] rounded-2xl border-0 bg-[#fff1f1] px-4 py-3 text-xs text-[#ed5454] dark:bg-[#641f24] dark:text-white"
            >
              {notice}
            </div>
          )}
          {view === 'dashboard' && (
            <Dashboard
              ticker={ticker}
              setTicker={setTicker}
              analysisDate={analysisDate}
              setAnalysisDate={setAnalysisDate}
              depth={depth}
              setDepth={setDepth}
              focus={focus}
              setFocus={setFocus}
              onSubmit={startAnalysis}
              busy={busy}
              runs={runs}
              openRun={openRun}
              openDemo={openDemo}
            />
          )}
          {view === 'run' && (
            <RunWorkspace
              run={activeRun}
              events={events}
              progress={progress}
              onBack={() => setView('dashboard')}
              onChat={() => setView('chat')}
            />
          )}
          {view === 'history' && (
            <HistoryView
              runs={runs}
              openRun={openRun}
              onRefresh={refreshData}
            />
          )}
          {view === 'profile' && (
            <ProfileView profile={profile} setProfile={setProfile} />
          )}
          {view === 'chat' && (
            <ChatView
              run={activeRun}
              mode={mode}
              profile={profile}
              threads={chatThreads}
              setThreads={setChatThreads}
            />
          )}
        </section>
      </div>
      <MobileNav view={view} onNavigate={setView} />
    </main>
  );
}

function Header({
  health,
  darkMode,
  onToggleTheme,
}: {
  health: {
    status: string;
    provider: string;
    api_key_configured: boolean;
  } | null;
  darkMode: boolean;
  onToggleTheme: () => void;
}) {
  const connected = health?.status === 'ok';
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 md:px-7">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-[10px] bg-primary text-primary-foreground">
            <BrainCircuit className="size-[19px]" />
          </div>
          <div>
            <p className="text-[15px] font-semibold">认知交易舱</p>
            <p className="text-[11px] text-muted-foreground">
              多 Agent 投研工作台
            </p>
          </div>
        </div>
        <div className="hidden items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground sm:flex">
          <span
            className={`size-2 rounded-full ${connected ? 'bg-[#35a34d]' : 'bg-[#ed5454]'}`}
          />
          {connected ? `${health?.provider ?? 'Agent'} 已连接` : '后端未连接'}
          {connected && !health?.api_key_configured && (
            <span>· API Key 未配置</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="搜索">
            <Search />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleTheme}
            aria-label={darkMode ? '切换到浅色模式' : '切换到深色模式'}
          >
            {darkMode ? <Sun /> : <Moon />}
          </Button>
          <Button variant="ghost" className="hidden px-3 sm:inline-flex">
            <Settings2 /> 设置
          </Button>
          <div className="ml-1 grid size-9 place-items-center rounded-full bg-secondary text-xs font-semibold text-primary">
            Y
          </div>
        </div>
      </div>
    </header>
  );
}

function MobileNav({
  view,
  onNavigate,
}: {
  view: AppView;
  onNavigate: (view: AppView) => void;
}) {
  return (
    <nav
      aria-label="移动端主导航"
      className="mobile-finance-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-card px-2 pt-2 md:hidden"
    >
      {navItems.map(({ id, label, icon: Icon }) => {
        const active = view === id || (view === 'run' && id === 'dashboard');
        return (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={`flex min-h-12 flex-col items-center justify-center gap-1 text-[10px] ${active ? 'text-primary' : 'text-muted-foreground'}`}
          >
            <Icon className="size-5" fill={active ? 'currentColor' : 'none'} />
            <span>{label.replace('今日', '').replace('Agent ', '')}</span>
          </button>
        );
      })}
    </nav>
  );
}

function Sidebar({
  view,
  onNavigate,
}: {
  view: AppView;
  onNavigate: (view: AppView) => void;
}) {
  return (
    <aside className="hidden min-h-[calc(100vh-64px)] border-r border-border bg-card px-3 py-6 md:block">
      <nav aria-label="主导航" className="space-y-1">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={`flex min-h-12 w-full items-center gap-3 rounded-[10px] px-3 text-left text-sm font-medium transition-colors ${view === id || (view === 'run' && id === 'dashboard') ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
          >
            <Icon className="size-5" />
            {label}
          </button>
        ))}
      </nav>
      <div className="px-3 pt-40">
        <div className="border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
          <p>本地研究环境</p>
          <p>TradingAgents · 投研决策支持</p>
        </div>
      </div>
    </aside>
  );
}

type DashboardProps = {
  ticker: string;
  setTicker: (value: string) => void;
  analysisDate: string;
  setAnalysisDate: (value: string) => void;
  depth: string;
  setDepth: (value: string) => void;
  focus: string;
  setFocus: (value: string) => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  busy: boolean;
  runs: AnalysisRun[];
  openRun: (id: string) => void;
  openDemo: () => void;
};

function Dashboard(props: DashboardProps) {
  return (
    <div className="mx-auto flex max-w-[1120px] flex-col">
      <div className="order-1 mb-8">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-4 text-primary" /> 个人研究工作台
          </p>
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.015em]">
            今天想研究什么？
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            专业 Agent 提供证据，个人助手负责把结论讲清楚。
          </p>
        </div>
      </div>
      <div className="order-3 mt-6 grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
        <Card className="border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="size-4 text-primary" /> AI 自选股
            </CardTitle>
            <CardDescription>
              结合你的关注原因与最近研究，快速进入分析
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {DEMO_WATCHLIST.map((item) => (
                <div
                  key={item.ticker}
                  className="flex min-h-16 items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <button
                    type="button"
                    onClick={() => props.setTicker(item.ticker)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-semibold">
                        {item.ticker}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {item.name}
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-[11px] text-muted-foreground">
                      {item.reason}
                    </span>
                  </button>
                  {item.hasDemo ? (
                    <Button size="sm" onClick={props.openDemo}>
                      查看案例 <ChevronRight />
                    </Button>
                  ) : (
                    <Badge variant="secondary">{item.status}</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="size-4 text-primary" /> 最近浏览
            </CardTitle>
            <CardDescription>仅使用你已授权的站内记录</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {DEMO_RECENT_VIEWS.map((item) => (
                <button
                  key={`${item.ticker}-${item.time}`}
                  type="button"
                  onClick={() => props.setTicker(item.ticker)}
                  className="flex w-full items-start justify-between gap-3 text-left"
                >
                  <span>
                    <span className="block text-xs font-semibold">
                      {item.ticker}
                    </span>
                    <span className="mt-1 block text-[11px] text-muted-foreground">
                      {item.topic}
                    </span>
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {item.time}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <Card className="analysis-card order-2 gap-0 border-0 py-0">
        <div className="grid gap-0 lg:grid-cols-[1fr_245px]">
          <form onSubmit={props.onSubmit} className="p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xl font-semibold">发起一次分析</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  支持美股、港股、A 股与加密资产代码
                </p>
              </div>
              <Badge className="bg-secondary text-primary">实时研究入口</Badge>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-[minmax(0,1.25fr)_minmax(190px,.75fr)]">
              <label htmlFor="ticker" className="space-y-2">
                <span className="text-sm font-medium">股票或资产代码</span>
                <Input
                  id="ticker"
                  value={props.ticker}
                  onChange={(event) =>
                    props.setTicker(event.target.value.toUpperCase())
                  }
                  required
                  className="text-base font-semibold"
                  placeholder="例如 NVDA、0700.HK"
                />
              </label>
              <label htmlFor="depth" className="space-y-2">
                <span className="text-sm font-medium">研究深度</span>
                <NativeSelect
                  id="depth"
                  value={props.depth}
                  onChange={(event) => props.setDepth(event.target.value)}
                  className="w-full"
                >
                  <NativeSelectOption value="quick">
                    快速扫描 · 约 3–5 分钟
                  </NativeSelectOption>
                  <NativeSelectOption value="standard">
                    标准分析 · 约 8–12 分钟
                  </NativeSelectOption>
                  <NativeSelectOption value="deep">
                    深度研究 · 约 15–25 分钟
                  </NativeSelectOption>
                </NativeSelect>
              </label>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label htmlFor="analysis-date" className="space-y-2">
                <span className="text-sm font-medium">分析日期</span>
                <Input
                  id="analysis-date"
                  type="date"
                  value={props.analysisDate}
                  onChange={(event) =>
                    props.setAnalysisDate(event.target.value)
                  }
                  required
                />
              </label>
              <label htmlFor="focus" className="space-y-2">
                <span className="text-sm font-medium">重点关注</span>
                <NativeSelect
                  id="focus"
                  value={props.focus}
                  onChange={(event) => props.setFocus(event.target.value)}
                  className="w-full"
                >
                  <NativeSelectOption>综合判断</NativeSelectOption>
                  <NativeSelectOption>估值与基本面</NativeSelectOption>
                  <NativeSelectOption>趋势与技术面</NativeSelectOption>
                  <NativeSelectOption>风险与仓位</NativeSelectOption>
                </NativeSelect>
              </label>
            </div>
            <div className="mt-6 flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
              <p className="text-xs text-muted-foreground">
                分析仅用于研究，不构成投资建议
              </p>
              <Button
                disabled={props.busy}
                className="h-12 rounded-[10px] bg-primary px-5 text-base text-white hover:bg-[#1e5fc7]"
              >
                {props.busy ? <LoaderCircle className="animate-spin" /> : null}
                开始多 Agent 分析 <ArrowRight />
              </Button>
            </div>
          </form>
          <AgentRail />
        </div>
      </Card>
      {props.runs.length > 0 && (
        <div className="order-4 mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-semibold">最近研究</h2>
            <span className="text-xs text-muted-foreground">本地保存</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {props.runs.slice(0, 3).map((run) => (
              <RunCard
                key={run.id}
                run={run}
                onClick={() => props.openRun(run.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AgentRail({ currentStage }: { currentStage?: string }) {
  const currentIndex = agentRail.findIndex(
    (item) => item.stage === currentStage,
  );
  return (
    <div className="evidence-grid border-t border-border/70 bg-secondary/45 p-5 lg:border-l lg:border-t-0">
      <p className="font-data text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
        Agent evidence rail
      </p>
      <div className="relative mt-5 space-y-4 before:absolute before:bottom-4 before:left-[17px] before:top-4 before:w-px before:bg-border">
        {agentRail.map(({ name, role, icon: Icon, tone }, index) => {
          const done = currentIndex >= index || currentStage === 'complete';
          const active = currentIndex === index;
          return (
            <div key={name} className="relative z-10 flex items-center gap-3">
              <div
                className={`agent-node agent-node-${tone} ${active ? 'agent-node-active' : ''}`}
              >
                {done && !active ? (
                  <Check className="size-3.5" />
                ) : (
                  <Icon
                    className={`size-3.5 ${active ? 'animate-pulse' : ''}`}
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold">{name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {active ? '正在工作' : done ? '已完成' : role}
                </p>
              </div>
              <span className="font-data text-[9px] text-muted-foreground">
                0{index + 1}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RunCard({ run, onClick }: { run: AnalysisRun; onClick: () => void }) {
  const tone = signalTone(run.signal);
  return (
    <button
      onClick={onClick}
      className="rounded-2xl bg-card p-4 text-left transition-colors hover:bg-secondary/35"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="font-data text-base font-semibold">{run.ticker}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {run.analysis_date} · {run.depth}
          </p>
        </div>
        <StatusBadge status={run.status} signal={run.signal} />
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span
          className={`text-xs font-medium ${tone === 'positive' ? 'text-[#ED5454]' : tone === 'negative' ? 'text-[#35A34D]' : 'text-muted-foreground'}`}
        >
          {run.signal ?? '分析进行中'}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {formatTime(run.created_at)}
        </span>
      </div>
    </button>
  );
}

function StatusBadge({
  status,
  signal,
}: {
  status: AnalysisRun['status'];
  signal?: string;
}) {
  if (status === 'completed')
    return (
      <Badge className="bg-[#EAF7ED] text-[#25853B] hover:bg-[#EAF7ED] dark:bg-[#173D22] dark:text-[#77CF89]">
        {signal || '已完成'}
      </Badge>
    );
  if (status === 'failed') return <Badge variant="destructive">失败</Badge>;
  return (
    <Badge variant="secondary">
      <LoaderCircle className="animate-spin" />{' '}
      {status === 'queued' ? '排队中' : '分析中'}
    </Badge>
  );
}

function RunWorkspace({
  run,
  events,
  progress,
  onBack,
  onChat,
}: {
  run: AnalysisRun | null;
  events: AnalysisEvent[];
  progress: number;
  onBack: () => void;
  onChat: () => void;
}) {
  if (!run)
    return (
      <EmptyState
        title="尚未选择分析任务"
        description="返回工作台发起分析，或从分析记录中选择一个任务。"
        action={<Button onClick={onBack}>返回工作台</Button>}
      />
    );
  const latestStage =
    events.at(-1)?.stage ??
    (run.status === 'completed' ? 'complete' : 'queued');
  return (
    <div className="mx-auto max-w-[1180px]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            aria-label="返回"
          >
            <ArrowLeft />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-data text-xl font-semibold">{run.ticker}</h1>
              <StatusBadge status={run.status} signal={run.signal} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {run.analysis_date} · {run.depth} analysis
            </p>
          </div>
        </div>
        {run.id === DEMO_RUN.id && (
          <Badge className="bg-[#FFF6E5] text-[#A86E00] hover:bg-[#FFF6E5] dark:bg-[#5C3B00] dark:text-[#FFD36A]">
            预置交互案例 · 非实时
          </Badge>
        )}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-5">
          <Card className="border-0">
            <CardHeader>
              <CardTitle>分析进度</CardTitle>
              <CardDescription>
                {events.at(-1)?.title ?? '正在准备研究任务'}
              </CardDescription>
              <CardAction>
                <span className="font-data text-sm font-semibold">
                  {progress}%
                </span>
              </CardAction>
            </CardHeader>
            <CardContent>
              <Progress value={progress} className="h-2" />
              <div className="mt-5 grid gap-3 sm:grid-cols-5">
                {agentRail.map(({ name, icon: Icon }, index) => {
                  const currentIndex = agentRail.findIndex(
                    (item) => item.stage === latestStage,
                  );
                  const done =
                    currentIndex >= index || latestStage === 'complete';
                  return (
                    <div
                      key={name}
                      className={`rounded-xl p-3 ${done ? 'bg-secondary text-primary' : 'bg-muted/45 text-muted-foreground opacity-60'}`}
                    >
                      <Icon className="size-4" />
                      <p className="mt-2 text-[10px] font-medium">{name}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
          {run.status === 'failed' ? (
            <div className="rounded-2xl bg-[#FFF1F1] p-5 dark:bg-[#641F24]">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#C93F3F] dark:text-[#FFB3B3]">
                <XCircle className="size-4" /> 分析未完成
              </div>
              <p className="mt-2 text-xs leading-5 text-[#9F3434] dark:text-[#FFD0D0]">
                {run.error}
              </p>
            </div>
          ) : run.report ? (
            <ReportView
              report={run.report}
              isDemo={run.id === DEMO_RUN.id}
              onChat={onChat}
            />
          ) : (
            <EmptyState
              title="Agent 正在生成研究报告"
              description="报告会随着分析完成自动出现在这里。你可以在右侧查看每个 Agent 的实时进度。"
            />
          )}
        </div>
        <div className="space-y-5">
          <AgentRail currentStage={latestStage} />
          <EventTimeline events={events} />
        </div>
      </div>
    </div>
  );
}

function EventTimeline({ events }: { events: AnalysisEvent[] }) {
  return (
    <Card className="max-h-[480px] border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock3 className="size-4" /> Agent 活动
        </CardTitle>
        <CardDescription>仅展示可核验的公开进度</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {events.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              等待第一个 Agent 事件…
            </p>
          ) : (
            events.map((event) => (
              <div
                key={event.id}
                className="relative border-l border-border pl-4"
              >
                <span
                  className={`absolute -left-1 top-1 size-2 rounded-full ${event.kind === 'error' ? 'bg-[#ED5454]' : event.kind === 'complete' ? 'bg-[#35A34D]' : 'bg-primary'}`}
                />
                <p className="text-xs font-semibold">{event.title}</p>
                <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                  {event.detail}
                </p>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ReportView({
  report,
  isDemo,
  onChat,
}: {
  report: NonNullable<AnalysisRun['report']>;
  isDemo: boolean;
  onChat: () => void;
}) {
  const visibleSections = Object.keys(report.sections);
  return (
    <div className="space-y-5">
      {isDemo && (
        <div className="rounded-2xl bg-[#FFF6E5] p-4 text-xs leading-5 text-[#7A5100] dark:bg-[#5C3B00] dark:text-[#FFE3A3]">
          <strong>预置交互案例：</strong>
          内容用于稳定展示完整产品流程，数据窗口截至 {report.analysis_date}
          ，不代表当前行情，也不是实时投资建议。
        </div>
      )}
      <Card className="border-0 bg-primary text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Sparkles className="size-4 text-white" /> 个人助手摘要
          </CardTitle>
          <CardAction>
            <SignalPill signal={report.signal} />
          </CardAction>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-7 text-white/85">
            {report.assistant_brief}
          </p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {[
              ['事实', '增长驱动与竞争优势有报告依据'],
              ['推断', '高预期能否兑现仍取决于后续数据'],
              ['未知', '需求持续性与个人持仓信息'],
              ['失效条件', '需求或盈利质量偏离当前假设'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-white/10 p-3">
                <p className="text-[10px] font-medium text-white/60">{label}</p>
                <p className="mt-1 text-xs leading-5 text-white">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={onChat}
              variant="outline"
              className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              <MessageSquareMore /> 追问个人助手
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card className="border-0">
        <CardHeader>
          <CardTitle>组合经理结论</CardTitle>
          <CardDescription>最终建议、条件与主要风险</CardDescription>
        </CardHeader>
        <CardContent>
          <ReportText text={report.summary} />
        </CardContent>
      </Card>
      {visibleSections.map((key) =>
        report.sections[key] ? (
          <Card key={key} className="border-0">
            <CardHeader>
              <CardTitle>{sectionLabels[key] ?? key}</CardTitle>
              <CardDescription>原始 Agent 报告与可核验研究依据</CardDescription>
            </CardHeader>
            <CardContent>
              <ReportText text={report.sections[key]} />
            </CardContent>
          </Card>
        ) : null,
      )}
    </div>
  );
}

function ReportText({ text }: { text: string }) {
  return (
    <div className="report-text whitespace-pre-wrap text-[13px] leading-7 text-foreground/85">
      {text}
    </div>
  );
}

function SignalPill({ signal }: { signal?: string }) {
  const tone = signalTone(signal);
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${tone === 'positive' ? 'bg-[#ED5454] text-white' : tone === 'negative' ? 'bg-[#35A34D] text-white' : 'bg-white/15 text-white'}`}
    >
      {signal ?? 'REVIEW'}
    </span>
  );
}

function HistoryView({
  runs,
  openRun,
  onRefresh,
}: {
  runs: AnalysisRun[];
  openRun: (id: string) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="mx-auto max-w-[1120px]">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">研究档案</p>
          <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em]">
            分析记录
          </h1>
        </div>
        <Button variant="outline" onClick={onRefresh}>
          <RefreshCw /> 刷新
        </Button>
      </div>
      {runs.length === 0 ? (
        <EmptyState
          title="还没有分析记录"
          description="从今日工作台发起第一次多 Agent 分析。"
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {runs.map((run) => (
            <RunCard key={run.id} run={run} onClick={() => openRun(run.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProfileView({
  profile,
  setProfile,
}: {
  profile: UserProfile;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
}) {
  const [inferences, setInferences] = useState([
    '经常关注财报后的基本面变化',
    '偏好先看反面证据与失效条件',
  ]);

  function update<K extends keyof UserProfile>(key: K, value: UserProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="mx-auto max-w-[1120px]">
      <div className="mb-6">
        <p className="text-xs font-medium text-muted-foreground">个人中心</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em]">
          我的投研
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          个人画像只帮助 Agent
          调整解释顺序、术语和详略，不会改变市场事实、证据权重或专业结论。
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <Card className="border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="size-4 text-primary" /> 我的解释偏好
            </CardTitle>
            <CardDescription>
              你可以随时修改，下一次对话立即生效
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium">信息展开方式</span>
                <NativeSelect
                  value={profile.explanationPreference}
                  onChange={(event) =>
                    update('explanationPreference', event.target.value)
                  }
                  className="w-full"
                >
                  <NativeSelectOption>先结论，后依据</NativeSelectOption>
                  <NativeSelectOption>先证据，后结论</NativeSelectOption>
                  <NativeSelectOption>按争议点逐项展开</NativeSelectOption>
                </NativeSelect>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">常用关注周期</span>
                <NativeSelect
                  value={profile.typicalHorizon}
                  onChange={(event) =>
                    update('typicalHorizon', event.target.value)
                  }
                  className="w-full"
                >
                  <NativeSelectOption>短期（1–4 周）</NativeSelectOption>
                  <NativeSelectOption>中期（1–6 个月）</NativeSelectOption>
                  <NativeSelectOption>中长期（6–24 个月）</NativeSelectOption>
                </NativeSelect>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">优先关注</span>
                <NativeSelect
                  value={profile.focus}
                  onChange={(event) => update('focus', event.target.value)}
                  className="w-full"
                >
                  <NativeSelectOption>基本面与下行风险</NativeSelectOption>
                  <NativeSelectOption>价格趋势与事件催化</NativeSelectOption>
                  <NativeSelectOption>多空分歧与未知信息</NativeSelectOption>
                </NativeSelect>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">专业术语</span>
                <NativeSelect
                  value={profile.terminology}
                  onChange={(event) =>
                    update('terminology', event.target.value)
                  }
                  className="w-full"
                >
                  <NativeSelectOption>首次出现时解释</NativeSelectOption>
                  <NativeSelectOption>直接使用并附注</NativeSelectOption>
                  <NativeSelectOption>只在必要时使用</NativeSelectOption>
                </NativeSelect>
              </label>
            </div>
            <div className="mt-6 rounded-xl bg-secondary p-4 text-xs leading-6 text-secondary-foreground">
              <strong>当前解释方式：</strong>
              {profile.explanationPreference}；重点关注{profile.focus}
              ；专业术语会
              {profile.terminology}。
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="border-0">
            <CardHeader>
              <CardTitle>数据授权</CardTitle>
              <CardDescription>关闭后仍可使用标准投研分析</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">个性化解释</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    允许 Agent 参考你明确设置的偏好
                  </p>
                </div>
                <Switch
                  checked={profile.personalizationEnabled}
                  onCheckedChange={(checked) =>
                    update('personalizationEnabled', checked)
                  }
                  aria-label="启用个性化解释"
                />
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-border pt-5">
                <div>
                  <p className="text-sm font-medium">站内浏览记录</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    用于关联自选股和最近关注主题
                  </p>
                </div>
                <Switch
                  checked={profile.historyEnabled}
                  onCheckedChange={(checked) =>
                    update('historyEnabled', checked)
                  }
                  aria-label="允许使用站内浏览记录"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0">
            <CardHeader>
              <CardTitle>AI 推测</CardTitle>
              <CardDescription>不是用户事实，可随时删除或纠正</CardDescription>
            </CardHeader>
            <CardContent>
              {inferences.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  当前没有保留的 AI 推测标签。
                </p>
              ) : (
                <div className="space-y-2">
                  {inferences.map((item) => (
                    <div
                      key={item}
                      className="flex items-center justify-between gap-3 rounded-xl bg-muted/55 px-3 py-2.5"
                    >
                      <span className="text-xs">AI 推测 · {item}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setInferences((current) =>
                            current.filter((value) => value !== item),
                          )
                        }
                        className="min-h-9 shrink-0 text-[11px] font-medium text-primary"
                      >
                        删除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mt-5 border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bookmark className="size-4 text-primary" /> 画像依据
          </CardTitle>
          <CardDescription>只展示产品内已经授权的输入</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['自选股', `${DEMO_WATCHLIST.length} 个关注标的`],
              ['最近浏览', `${DEMO_RECENT_VIEWS.length} 条可见记录`],
              ['分析记录', '1 份预置案例'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-muted/45 p-4">
                <p className="text-[11px] text-muted-foreground">{label}</p>
                <p className="mt-2 text-sm font-semibold">{value}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] leading-5 text-muted-foreground">
            系统不会根据浏览记录推断你的资产规模、真实持仓、成本或风险承受能力；买卖类问题需要当次确认。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ChatView({
  run,
  mode,
  profile,
  threads,
  setThreads,
}: {
  run: AnalysisRun | null;
  mode: CognitiveMode;
  profile: UserProfile;
  threads: Record<ChatChannelId, ChatMessage[]>;
  setThreads: React.Dispatch<
    React.SetStateAction<Record<ChatChannelId, ChatMessage[]>>
  >;
}) {
  const [channel, setChannel] = useState<ChatChannelId>('group');
  const [message, setMessage] = useState('');
  const [loadingChannels, setLoadingChannels] = useState<
    Partial<Record<ChatChannelId, boolean>>
  >({});
  const [error, setError] = useState('');
  const runId = run?.id;
  const isDemoGroup = channel === 'group' && runId === DEMO_RUN.id;
  const storedMessages = threads[channel].filter(
    (item) => item.runId === runId,
  );
  const activeMessages = isDemoGroup
    ? [...demoGroupConversation, ...storedMessages]
    : storedMessages;
  const loading = Boolean(loadingChannels[channel]);
  const latestMessageFor = (channelId: ChatAgentId) =>
    threads[channelId].findLast((item) => item.runId === runId)?.content;

  function selectChannel(nextChannel: ChatChannelId) {
    setChannel(nextChannel);
    setError('');
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim()) return;
    const activeChannel = channel;
    const outgoing = message.trim();
    const history = activeMessages.slice(-12).map((item) => ({
      role: item.role,
      content:
        item.role === 'assistant'
          ? `[${agentLabels[item.agent ?? 'personal']}] ${item.content}`
          : item.content,
    }));
    setThreads((current) => ({
      ...current,
      [activeChannel]: [
        ...current[activeChannel],
        { role: 'user', content: outgoing, runId },
      ],
    }));
    setMessage('');
    setLoadingChannels((current) => ({ ...current, [activeChannel]: true }));
    setError('');
    try {
      if (run?.id === DEMO_RUN.id) {
        const demoAgents =
          activeChannel === 'group' ? routedAgents(outgoing) : [activeChannel];
        await new Promise((resolve) => window.setTimeout(resolve, 360));
        setThreads((current) => ({
          ...current,
          [activeChannel]: [
            ...current[activeChannel],
            ...demoAgents.map((agent) => ({
              role: 'assistant' as const,
              agent,
              runId,
              content:
                DEMO_AGENT_REPLIES[agent] ??
                '当前预置案例没有覆盖这个角色的更多证据。请返回总工作群，或启动实时服务继续分析。',
            })),
          ],
        }));
        return;
      }

      if (activeChannel === 'group') {
        const selectedAgents = routedAgents(outgoing);
        const professionalAgents = selectedAgents.filter(
          (agentId) => agentId !== 'personal',
        );
        const results = await Promise.allSettled(
          professionalAgents.map(async (agentId) => {
            const response = await tradingApi.chat({
              run_id: run?.id,
              agent: agentId,
              message: outgoing,
              cognitive_mode: mode,
              user_context: profileContext(profile),
              history,
            });
            return {
              role: 'assistant' as const,
              agent: response.agent as ChatAgentId,
              runId,
              content: response.answer,
            };
          }),
        );
        const replies = results.flatMap((result) =>
          result.status === 'fulfilled' ? [result.value] : [],
        );
        const failedCount = results.length - replies.length;
        if (replies.length === 0) {
          throw results[0].status === 'rejected'
            ? results[0].reason
            : new Error('团队暂时无法回答');
        }
        setThreads((current) => ({
          ...current,
          group: [...current.group, ...replies],
        }));

        const summary = await tradingApi.chat({
          run_id: run?.id,
          agent: 'personal',
          message: `请基于专业角色回复总结用户的问题：${outgoing}`,
          cognitive_mode: mode,
          user_context: profileContext(profile),
          history: [
            ...history,
            ...replies.map((reply) => ({
              role: 'assistant' as const,
              content: `[${agentLabels[reply.agent]}] ${reply.content}`,
            })),
          ],
        });
        setThreads((current) => ({
          ...current,
          group: [
            ...current.group,
            {
              role: 'assistant',
              agent: 'personal',
              runId,
              content: summary.answer,
            },
          ],
        }));
        if (failedCount > 0) {
          setError(`${failedCount} 位 Agent 暂时未能回复，其他回复已送达。`);
        }
      } else {
        const response = await tradingApi.chat({
          run_id: run?.id,
          agent: activeChannel,
          message: outgoing,
          cognitive_mode: mode,
          user_context: profileContext(profile),
          history,
        });
        setThreads((current) => ({
          ...current,
          [activeChannel]: [
            ...current[activeChannel],
            {
              role: 'assistant',
              agent: response.agent as ChatAgentId,
              runId,
              content: response.answer,
            },
          ],
        }));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Agent 暂时无法回答');
    } finally {
      setLoadingChannels((current) => ({
        ...current,
        [activeChannel]: false,
      }));
    }
  }

  const currentTitle =
    channel === 'group' ? '投研总工作群' : agentLabels[channel];
  const currentDescription =
    channel === 'group'
      ? `你、个人助手与 8 位协作角色${run ? ` · ${run.ticker}` : ''}`
      : `${agentDescriptions[channel]}${run ? ` · 已关联 ${run.ticker}` : ''}`;

  return (
    <div className="mx-auto max-w-[1120px]">
      <div className="mb-6">
        <p className="text-xs font-medium text-muted-foreground">Agent 协同</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em]">
          Agent 协作室
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          在总工作群汇总观点，也可以进入任意成员的独立单聊。
        </p>
      </div>
      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <Card className="h-fit border-0 lg:sticky lg:top-20">
          <CardHeader className="pb-3">
            <CardTitle>消息</CardTitle>
            <CardDescription>
              {run ? `已关联 ${run.ticker} 报告` : '未关联分析报告'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-2 px-2 text-[11px] font-medium text-muted-foreground">
              群聊
            </p>
            <button
              onClick={() => selectChannel('group')}
              className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left transition-colors ${channel === 'group' ? 'bg-secondary text-secondary-foreground' : 'hover:bg-muted/60'}`}
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-primary text-white">
                <Users className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">
                  投研总工作群
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                  你 + 9 位 Agent
                </span>
              </span>
              {loadingChannels.group && (
                <LoaderCircle className="size-3.5 animate-spin text-primary" />
              )}
            </button>

            <div className="mb-2 mt-6 flex items-center justify-between px-2">
              <p className="text-[11px] font-medium text-muted-foreground">
                单聊
              </p>
              <span className="text-[10px] text-muted-foreground">
                {chatAgentIds.length} 位成员
              </span>
            </div>
            <div className="max-h-[490px] space-y-1 overflow-y-auto pr-1">
              {chatAgentIds.map((agentId) => (
                <button
                  key={agentId}
                  onClick={() => selectChannel(agentId)}
                  className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left transition-colors ${channel === agentId ? 'bg-secondary text-secondary-foreground' : 'hover:bg-muted/60'}`}
                >
                  <Avatar className="size-9">
                    <AvatarFallback className={agentAvatarStyles[agentId]}>
                      {agentLabels[agentId].slice(0, 1)}
                    </AvatarFallback>
                    <AvatarBadge className="bg-[#35A34D]" />
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      {agentLabels[agentId]}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                      {latestMessageFor(agentId) ?? agentDescriptions[agentId]}
                    </span>
                  </span>
                  {loadingChannels[agentId] && (
                    <LoaderCircle className="size-3.5 animate-spin text-primary" />
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="min-h-[600px] border-0">
          <CardHeader className="border-b border-border">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                {channel === 'group' ? (
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-white">
                    <Users className="size-5" />
                  </span>
                ) : (
                  <Avatar size="lg">
                    <AvatarFallback className={agentAvatarStyles[channel]}>
                      {agentLabels[channel].slice(0, 1)}
                    </AvatarFallback>
                    <AvatarBadge className="bg-[#35A34D]" />
                  </Avatar>
                )}
                <div className="min-w-0">
                  <CardTitle>{currentTitle}</CardTitle>
                  <CardDescription className="mt-1 truncate">
                    {currentDescription}
                  </CardDescription>
                </div>
              </div>
              {channel === 'group' && (
                <AvatarGroup className="hidden sm:flex">
                  {chatAgentIds.slice(0, 3).map((agentId) => (
                    <Avatar key={agentId} size="sm">
                      <AvatarFallback className={agentAvatarStyles[agentId]}>
                        {agentLabels[agentId].slice(0, 1)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  <AvatarGroupCount>+6</AvatarGroupCount>
                </AvatarGroup>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[430px] space-y-5 overflow-y-auto bg-background/55 p-4 sm:p-5">
              {isDemoGroup && (
                <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[#FFF6E5] px-3 py-2.5 text-[11px] leading-5 text-[#7A5100] dark:bg-[#5C3B00] dark:text-[#FFE3A3]">
                  <Badge className="bg-white/75 text-[#7A5100] hover:bg-white/75 dark:bg-white/15 dark:text-[#FFE3A3]">
                    预置案例对话 · 非实时
                  </Badge>
                  <span>基于 NVDA 2025-02-27 演示报告，不代表当前行情</span>
                </div>
              )}
              {activeMessages.length === 0 && (
                <div className="grid h-full place-items-center text-center">
                  <div className="max-w-sm">
                    <span className="mx-auto grid size-12 place-items-center rounded-xl bg-secondary text-primary">
                      {channel === 'group' ? (
                        <Users className="size-5" />
                      ) : (
                        <MessageSquareMore className="size-5" />
                      )}
                    </span>
                    <p className="mt-4 text-sm font-semibold">
                      {channel === 'group'
                        ? '把问题发到投研总工作群'
                        : `与${agentLabels[channel]}开始单聊`}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {channel === 'group'
                        ? '个人助手会按问题调度相关角色，专业意见完成后再汇总共识、分歧与未知。'
                        : `此窗口有独立的对话记录，${agentLabels[channel]}会结合之前的聊天继续回答。`}
                    </p>
                  </div>
                </div>
              )}
              {activeMessages.map((item, index) => (
                <div
                  key={index}
                  className={`flex items-start gap-3 ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {item.role === 'assistant' && item.agent && (
                    <Avatar className="mt-0.5 size-8">
                      <AvatarFallback className={agentAvatarStyles[item.agent]}>
                        {agentLabels[item.agent].slice(0, 1)}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`max-w-[82%] rounded-2xl px-4 py-3 text-xs leading-6 ${item.role === 'user' ? 'bg-primary text-white' : 'bg-card'}`}
                  >
                    {item.role === 'assistant' && item.agent && (
                      <p className="mb-1 text-[11px] font-semibold text-primary">
                        {agentLabels[item.agent]}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap">{item.content}</p>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <LoaderCircle className="size-3.5 animate-spin" />
                  {channel === 'group'
                    ? '团队成员正在陆续回复…'
                    : `${agentLabels[channel]}正在整理证据…`}
                </div>
              )}
            </div>
            {isDemoGroup && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-medium text-muted-foreground">
                  继续模拟追问
                </span>
                {[
                  '结合这份报告，现在适合买入吗？',
                  '多头和空头的核心分歧是什么？',
                ].map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setMessage(prompt)}
                    className="min-h-9 rounded-[10px] border border-border-visible bg-card px-3 text-[11px] text-foreground hover:bg-muted"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}
            <form onSubmit={submit} className="mt-4">
              <div className="flex gap-2">
                <Input
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder={
                    channel === 'group'
                      ? '发送给投研总工作群…'
                      : `发送给${agentLabels[channel]}…`
                  }
                  className="h-12"
                />
                <Button
                  disabled={loading || !message.trim()}
                  className="h-12 bg-primary px-5 text-white hover:bg-primary/90"
                >
                  <Send /> 发送
                </Button>
              </div>
              <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-muted-foreground">
                <span>
                  {channel === 'group'
                    ? '个人助手将按问题调度相关角色，不进行多数投票'
                    : '此单聊拥有独立上下文'}
                </span>
                <span>参考：已关联报告 + 个人画像</span>
              </div>
            </form>
            {error && (
              <p className="mt-2 text-[11px] text-[#ED5454]">{error}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
