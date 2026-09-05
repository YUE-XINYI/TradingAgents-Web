'use client';

import { SubmitEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bot,
  BrainCircuit,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  Check,
  ChevronRight,
  Clock3,
  Gauge,
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
  Sun,
  TrendingDown,
  TrendingUp,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  API_BASE,
  AnalysisEvent,
  AnalysisRun,
  AppView,
  CognitiveMode,
  Portfolio,
  tradingApi,
} from '@/lib/trading-api';

const modes: { id: CognitiveMode; label: string; description: string }[] = [
  { id: 'beginner', label: '入门', description: '结论与白话解释' },
  { id: 'intermediate', label: '进阶', description: '证据、指标与分歧' },
  { id: 'expert', label: '专业', description: '完整报告与参数' },
];

const navItems: { id: AppView; label: string; icon: typeof LayoutDashboard }[] =
  [
    { id: 'dashboard', label: '今日工作台', icon: LayoutDashboard },
    { id: 'history', label: '分析记录', icon: ChartNoAxesCombined },
    { id: 'portfolio', label: '模拟交易', icon: BriefcaseBusiness },
    { id: 'chat', label: 'Agent 协作室', icon: MessageSquareMore },
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
  fundamentals: '基本面分析师',
  market: '技术分析师',
  risk: '风险经理',
  bear: '看空研究员',
  bull: '看多研究员',
};
const chatAgentIds = [
  'personal',
  'fundamentals',
  'market',
  'risk',
  'bear',
  'bull',
] as const;
type ChatAgentId = (typeof chatAgentIds)[number];
type ChatChannelId = 'group' | ChatAgentId;
type ChatMessage = {
  role: 'user' | 'assistant';
  agent?: ChatAgentId;
  content: string;
};
const agentDescriptions: Record<ChatAgentId, string> = {
  personal: '理解你的认知与决策偏好',
  fundamentals: '财务、估值与商业模式',
  market: '价格趋势与技术指标',
  risk: '下行风险与仓位边界',
  bear: '挑战乐观假设与寻找反例',
  bull: '寻找上涨驱动与触发条件',
};
const agentAvatarStyles: Record<ChatAgentId, string> = {
  personal: 'bg-primary text-white',
  fundamentals: 'bg-[#E9F1FD] text-[#2470EB] dark:bg-[#17345E]',
  market: 'bg-[#E8F7F7] text-[#168C91] dark:bg-[#123D3F]',
  risk: 'bg-[#FFF3E3] text-[#C67A16] dark:bg-[#553711]',
  bear: 'bg-[#EAF7ED] text-[#25853B] dark:bg-[#173D22]',
  bull: 'bg-[#FFF1F1] text-[#D94747] dark:bg-[#641F24]',
};

function money(value = 0) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 2,
  }).format(value);
}

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
  const [runs, setRuns] = useState<AnalysisRun[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [activeRun, setActiveRun] = useState<AnalysisRun | null>(null);
  const [events, setEvents] = useState<AnalysisEvent[]>([]);
  const [chatThreads, setChatThreads] = useState<
    Record<ChatChannelId, ChatMessage[]>
  >({
    group: [],
    personal: [],
    fundamentals: [],
    market: [],
    risk: [],
    bear: [],
    bull: [],
  });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const refreshData = useCallback(async () => {
    const [healthResult, runsResult, portfolioResult] =
      await Promise.allSettled([
        tradingApi.health(),
        tradingApi.runs(),
        tradingApi.portfolio(),
      ]);
    if (healthResult.status === 'fulfilled') setHealth(healthResult.value);
    if (runsResult.status === 'fulfilled') setRuns(runsResult.value);
    if (portfolioResult.status === 'fulfilled')
      setPortfolio(portfolioResult.value);
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
    const run = await tradingApi.run(id);
    setActiveRun(run);
    setEvents(run.events ?? []);
    setMode(run.cognitive_mode);
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
        <Sidebar view={view} mode={mode} onNavigate={setView} />
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
              mode={mode}
              setMode={setMode}
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
            />
          )}
          {view === 'run' && (
            <RunWorkspace
              run={activeRun}
              events={events}
              progress={progress}
              mode={mode}
              setMode={setMode}
              onBack={() => setView('dashboard')}
              onOrderComplete={(updated) => {
                setPortfolio(updated);
                setNotice('模拟订单已成交并写入本地账户');
              }}
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
          {view === 'portfolio' && <PortfolioView portfolio={portfolio} />}
          {view === 'chat' && (
            <ChatView
              run={activeRun}
              mode={mode}
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
  mode,
  onNavigate,
}: {
  view: AppView;
  mode: CognitiveMode;
  onNavigate: (view: AppView) => void;
}) {
  const currentMode = modes.find((item) => item.id === mode)!;
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
      <div className="mt-8 px-3">
        <p className="text-[11px] font-medium text-muted-foreground">
          当前表达模式
        </p>
        <div className="mt-3 rounded-xl bg-secondary p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-secondary-foreground">
              {currentMode.label}视图
            </span>
            <BookOpen className="size-4 text-primary" />
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {currentMode.description}
          </p>
        </div>
      </div>
      <div className="px-3 pt-40">
        <div className="border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
          <p>本地研究环境</p>
          <p>TradingAgents · 仅模拟交易</p>
        </div>
      </div>
    </aside>
  );
}

type DashboardProps = {
  mode: CognitiveMode;
  setMode: (value: CognitiveMode) => void;
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
};

function Dashboard(props: DashboardProps) {
  return (
    <div className="mx-auto max-w-[1120px]">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
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
        <ModeSwitch value={props.mode} onChange={props.setMode} />
      </div>
      <Card className="analysis-card gap-0 border-0 py-0">
        <div className="grid gap-0 lg:grid-cols-[1fr_245px]">
          <form onSubmit={props.onSubmit} className="p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xl font-semibold">发起一次分析</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  支持美股、港股、A 股与加密资产代码
                </p>
              </div>
              <Badge className="bg-secondary text-primary">模拟研究</Badge>
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
      <div className="mt-6">
        <AssistantCard mode={props.mode} />
      </div>
      {props.runs.length > 0 && (
        <div className="mt-8">
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

function ModeSwitch({
  value,
  onChange,
}: {
  value: CognitiveMode;
  onChange: (mode: CognitiveMode) => void;
}) {
  return (
    <div className="flex h-10 rounded-[10px] bg-card p-1">
      {modes.map((item) => (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          className={`rounded-lg px-4 text-xs font-medium transition-colors ${value === item.id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          {item.label}
        </button>
      ))}
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

function AssistantCard({ mode }: { mode: CognitiveMode }) {
  return (
    <Card className="border-0 bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <span className="grid size-9 place-items-center rounded-[10px] bg-secondary text-primary">
            <Bot className="size-5" />
          </span>
          你的个人助手
        </CardTitle>
        <CardDescription>
          按{modes.find((item) => item.id === mode)?.label}模式组织研究信息
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-6 text-muted-foreground">
          从熟悉的股票开始。我会解释关键分歧，并提示哪些结论还缺少证据。
        </p>
        <button className="mt-4 flex min-h-11 items-center gap-1 text-sm font-medium text-primary">
          了解认知分层 <ChevronRight className="size-4" />
        </button>
      </CardContent>
    </Card>
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
  mode,
  setMode,
  onBack,
  onOrderComplete,
  onChat,
}: {
  run: AnalysisRun | null;
  events: AnalysisEvent[];
  progress: number;
  mode: CognitiveMode;
  setMode: (mode: CognitiveMode) => void;
  onBack: () => void;
  onOrderComplete: (portfolio: Portfolio) => void;
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
        <ModeSwitch value={mode} onChange={setMode} />
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
            <ReportView report={run.report} mode={mode} onChat={onChat} />
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
          {run.report && (
            <PaperOrderForm run={run} onComplete={onOrderComplete} />
          )}
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
  mode,
  onChat,
}: {
  report: NonNullable<AnalysisRun['report']>;
  mode: CognitiveMode;
  onChat: () => void;
}) {
  const visibleSections =
    mode === 'beginner'
      ? ['risk_verdict']
      : mode === 'intermediate'
        ? ['market', 'fundamentals', 'bull_bear', 'risk_verdict']
        : Object.keys(report.sections);
  return (
    <div className="space-y-5">
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
          <ReportText text={report.summary} compact={mode === 'beginner'} />
        </CardContent>
      </Card>
      {visibleSections.map((key) =>
        report.sections[key] ? (
          <Card key={key} className="border-0">
            <CardHeader>
              <CardTitle>{sectionLabels[key] ?? key}</CardTitle>
              <CardDescription>
                {mode === 'expert'
                  ? '原始 Agent 报告'
                  : '与你当前认知模式匹配的研究证据'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ReportText
                text={report.sections[key]}
                compact={mode === 'beginner'}
              />
            </CardContent>
          </Card>
        ) : null,
      )}
    </div>
  );
}

function ReportText({ text, compact }: { text: string; compact?: boolean }) {
  const shown =
    compact && text.length > 1400 ? `${text.slice(0, 1400)}…` : text;
  return (
    <div className="report-text whitespace-pre-wrap text-[13px] leading-7 text-foreground/85">
      {shown}
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

function PaperOrderForm({
  run,
  onComplete,
}: {
  run: AnalysisRun;
  onComplete: (portfolio: Portfolio) => void;
}) {
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [quantity, setQuantity] = useState('10');
  const [price, setPrice] = useState('');
  const [thesis, setThesis] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await tradingApi.createOrder({
        ticker: run.ticker,
        side,
        quantity: Number(quantity),
        price: Number(price),
        linked_run_id: run.id,
        thesis,
      });
      onComplete(result.portfolio);
      setThesis('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '下单失败');
    } finally {
      setLoading(false);
    }
  }
  return (
    <Card className="border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BriefcaseBusiness className="size-4" /> 创建模拟订单
        </CardTitle>
        <CardDescription>手动输入模拟成交价，不会连接真实券商</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSide('buy')}
              className={`h-10 rounded-[10px] px-3 text-xs font-medium ${side === 'buy' ? 'bg-[#FFF1F1] text-[#D94747] dark:bg-[#641F24] dark:text-[#FFB3B3]' : 'bg-muted/55 text-muted-foreground'}`}
            >
              买入
            </button>
            <button
              type="button"
              onClick={() => setSide('sell')}
              className={`h-10 rounded-[10px] px-3 text-xs font-medium ${side === 'sell' ? 'bg-[#EAF7ED] text-[#25853B] dark:bg-[#173D22] dark:text-[#77CF89]' : 'bg-muted/55 text-muted-foreground'}`}
            >
              卖出
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              min="0.0001"
              step="any"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              placeholder="数量"
              required
            />
            <Input
              type="number"
              min="0.0001"
              step="any"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder="模拟成交价"
              required
            />
          </div>
          <Textarea
            value={thesis}
            onChange={(event) => setThesis(event.target.value)}
            placeholder="记录你的下单理由（可选）"
            className="min-h-20"
          />
          {error && <p className="text-[11px] text-[#ED5454]">{error}</p>}
          <Button
            disabled={loading}
            className="h-12 w-full bg-primary text-white hover:bg-primary/90"
          >
            {loading && <LoaderCircle className="animate-spin" />}确认模拟成交
          </Button>
        </form>
      </CardContent>
    </Card>
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

function PortfolioView({ portfolio }: { portfolio: Portfolio | null }) {
  if (!portfolio)
    return (
      <EmptyState
        title="正在读取模拟账户"
        description="本地后端连接后会显示模拟资金和持仓。"
      />
    );
  return (
    <div className="mx-auto max-w-[1120px]">
      <div className="mb-6">
        <p className="text-xs font-medium text-muted-foreground">模拟组合</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em]">
          模拟交易
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          所有订单均为本地模拟，不会触达真实资金。
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['总资产', money(portfolio.total_value)],
          ['可用现金', money(portfolio.cash)],
          ['持仓市值', money(portfolio.market_value)],
          [
            '累计收益',
            `${portfolio.total_return >= 0 ? '+' : ''}${portfolio.total_return.toFixed(2)}%`,
          ],
        ].map(([label, value], index) => (
          <Card
            key={label}
            size="sm"
            className={`border-0 ${index === 0 ? 'bg-primary text-white' : ''}`}
          >
            <CardContent>
              <p
                className={`text-[11px] ${index === 0 ? 'text-white/65' : 'text-muted-foreground'}`}
              >
                {label}
              </p>
              <p
                className={`mt-2 text-xl font-semibold tabular-nums ${index === 0 ? 'text-[26px] text-white' : index === 3 ? (portfolio.total_return >= 0 ? 'text-[#ED5454]' : 'text-[#35A34D]') : ''}`}
              >
                {index === 3
                  ? `${portfolio.total_return >= 0 ? '上涨 ' : '下跌 '}${value}`
                  : value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="mt-5 border-0">
        <CardHeader>
          <CardTitle>当前持仓</CardTitle>
          <CardDescription>{portfolio.positions.length} 个标的</CardDescription>
        </CardHeader>
        <CardContent>
          {portfolio.positions.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              还没有模拟持仓。完成分析后可以创建第一笔模拟订单。
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>标的</TableHead>
                  <TableHead>数量</TableHead>
                  <TableHead>平均成本</TableHead>
                  <TableHead>最新模拟价</TableHead>
                  <TableHead className="text-right">浮动盈亏</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {portfolio.positions.map((position) => {
                  const pnl =
                    position.quantity *
                    (position.last_price - position.average_price);
                  return (
                    <TableRow key={position.ticker}>
                      <TableCell className="font-data font-semibold">
                        {position.ticker}
                      </TableCell>
                      <TableCell>{position.quantity}</TableCell>
                      <TableCell>{money(position.average_price)}</TableCell>
                      <TableCell>{money(position.last_price)}</TableCell>
                      <TableCell
                        className={`text-right font-medium tabular-nums ${pnl >= 0 ? 'text-[#ED5454]' : 'text-[#35A34D]'}`}
                      >
                        {pnl >= 0 ? '+' : '-'}
                        {money(Math.abs(pnl))}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Card className="mt-5 border-0">
        <CardHeader>
          <CardTitle>订单记录</CardTitle>
          <CardDescription>每笔订单都可以关联分析和下单理由</CardDescription>
        </CardHeader>
        <CardContent>
          {portfolio.orders.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              暂无订单
            </p>
          ) : (
            <div className="space-y-2">
              {portfolio.orders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between rounded-lg bg-muted/45 p-3"
                >
                  <div className="flex items-center gap-3">
                    {order.side === 'buy' ? (
                      <TrendingUp className="size-4 text-[#ED5454]" />
                    ) : (
                      <TrendingDown className="size-4 text-[#35A34D]" />
                    )}
                    <div>
                      <p className="font-data text-xs font-semibold">
                        {order.ticker} ·{' '}
                        {order.side === 'buy' ? '买入' : '卖出'}{' '}
                        {order.quantity}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {order.thesis || '未记录下单理由'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-data text-xs">{money(order.value)}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {formatTime(order.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ChatView({
  run,
  mode,
  threads,
  setThreads,
}: {
  run: AnalysisRun | null;
  mode: CognitiveMode;
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
  const activeMessages = threads[channel];
  const loading = Boolean(loadingChannels[channel]);

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
        { role: 'user', content: outgoing },
      ],
    }));
    setMessage('');
    setLoadingChannels((current) => ({ ...current, [activeChannel]: true }));
    setError('');
    try {
      if (activeChannel === 'group') {
        const results = await Promise.allSettled(
          chatAgentIds.map(async (agentId) => {
            const response = await tradingApi.chat({
              run_id: run?.id,
              agent: agentId,
              message: outgoing,
              cognitive_mode: mode,
              history,
            });
            setThreads((current) => ({
              ...current,
              group: [
                ...current.group,
                {
                  role: 'assistant',
                  agent: response.agent as ChatAgentId,
                  content: response.answer,
                },
              ],
            }));
          }),
        );
        const failedCount = results.filter(
          (result) => result.status === 'rejected',
        ).length;
        if (failedCount === chatAgentIds.length) {
          throw results[0].status === 'rejected'
            ? results[0].reason
            : new Error('团队暂时无法回答');
        }
        if (failedCount > 0) {
          setError(`${failedCount} 位 Agent 暂时未能回复，其他回复已送达。`);
        }
      } else {
        const response = await tradingApi.chat({
          run_id: run?.id,
          agent: activeChannel,
          message: outgoing,
          cognitive_mode: mode,
          history,
        });
        setThreads((current) => ({
          ...current,
          [activeChannel]: [
            ...current[activeChannel],
            {
              role: 'assistant',
              agent: response.agent as ChatAgentId,
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
      ? `你、个人助手与 5 位专业分析师${run ? ` · ${run.ticker}` : ''}`
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
                  你 + 6 位 Agent
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
            <div className="space-y-1">
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
                      {threads[agentId].at(-1)?.content ??
                        agentDescriptions[agentId]}
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
                  <AvatarGroupCount>+3</AvatarGroupCount>
                </AvatarGroup>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[430px] space-y-5 overflow-y-auto bg-background/55 p-4 sm:p-5">
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
                        ? '个人助手和全部专业分析师都会收到消息，并从各自职责出发回复。'
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
                    ? '本条消息将通知全部 6 位 Agent'
                    : '此单聊拥有独立上下文'}
                </span>
                <span>
                  {modes.find((item) => item.id === mode)?.label}表达模式
                </span>
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
