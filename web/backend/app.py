from __future__ import annotations

import asyncio
import json
import os
import sqlite3
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field


PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env", override=False)

DB_PATH = Path(__file__).with_name("trading_copilot.db")
executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="trading-analysis")
event_lock = threading.Lock()
run_events: dict[str, list[dict[str, Any]]] = {}

frontend_origins = {
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
}
frontend_origins.update(
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", "").split(",")
    if origin.strip()
)

app = FastAPI(title="Cognitive Trading Desk API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(frontend_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalysisRequest(BaseModel):
    ticker: str = Field(min_length=1, max_length=24, pattern=r"^[A-Za-z0-9.\-^=]+$")
    analysis_date: str
    depth: Literal["quick", "standard", "deep"] = "standard"
    cognitive_mode: Literal["beginner", "intermediate", "expert"] = "intermediate"
    analysts: list[Literal["market", "social", "news", "fundamentals"]] = [
        "market",
        "social",
        "news",
        "fundamentals",
    ]


class ChatHistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    run_id: str | None = None
    agent: Literal[
        "personal",
        "market",
        "sentiment",
        "news",
        "fundamentals",
        "research",
        "bull",
        "bear",
        "research_manager",
        "trader",
        "risk",
        "risk_aggressive",
        "risk_neutral",
        "risk_conservative",
        "portfolio_manager",
    ] = "personal"
    message: str = Field(min_length=1, max_length=2000)
    cognitive_mode: Literal["beginner", "intermediate", "expert"] = "intermediate"
    user_context: str = Field(default="用户未授权个人画像。", max_length=3000)
    history: list[ChatHistoryMessage] = Field(default_factory=list, max_length=20)


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


def db() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH, timeout=30)
    connection.row_factory = sqlite3.Row
    return connection


def init_db() -> None:
    with db() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS runs (
                id TEXT PRIMARY KEY,
                ticker TEXT NOT NULL,
                analysis_date TEXT NOT NULL,
                depth TEXT NOT NULL,
                cognitive_mode TEXT NOT NULL,
                analysts_json TEXT NOT NULL,
                status TEXT NOT NULL,
                signal TEXT,
                report_json TEXT,
                error TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS account (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                initial_cash REAL NOT NULL,
                cash REAL NOT NULL
            );
            CREATE TABLE IF NOT EXISTS positions (
                ticker TEXT PRIMARY KEY,
                quantity REAL NOT NULL,
                average_price REAL NOT NULL,
                last_price REAL NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                ticker TEXT NOT NULL,
                side TEXT NOT NULL,
                quantity REAL NOT NULL,
                price REAL NOT NULL,
                value REAL NOT NULL,
                status TEXT NOT NULL,
                linked_run_id TEXT,
                thesis TEXT,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS chat_messages (
                id TEXT PRIMARY KEY,
                run_id TEXT,
                agent TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            INSERT OR IGNORE INTO account (id, initial_cash, cash)
            VALUES (1, 1000000, 1000000);
            """
        )


init_db()


def emit(run_id: str, kind: str, stage: str, title: str, detail: str = "", content: str = "") -> None:
    with event_lock:
        events = run_events.setdefault(run_id, [])
        events.append(
            {
                "id": len(events) + 1,
                "kind": kind,
                "stage": stage,
                "title": title,
                "detail": detail,
                "content": content[:1200],
                "timestamp": now_iso(),
            }
        )


def row_to_run(row: sqlite3.Row) -> dict[str, Any]:
    result = dict(row)
    result["analysts"] = json.loads(result.pop("analysts_json"))
    result["report"] = json.loads(result.pop("report_json")) if result.get("report_json") else None
    return result


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    return json.dumps(value, ensure_ascii=False, default=str)


def build_report(ticker: str, analysis_date: str, signal: str, state: dict[str, Any]) -> dict[str, Any]:
    final_decision = clean_text(state.get("final_trade_decision"))
    risk_state = state.get("risk_debate_state") or {}
    investment_state = state.get("investment_debate_state") or {}
    return {
        "ticker": ticker,
        "analysis_date": analysis_date,
        "signal": signal,
        "summary": final_decision,
        "assistant_brief": f"多 Agent 团队对 {ticker} 的最终评级为 {signal}。请先核对主要证据、相反观点与失效条件，再形成自己的判断。",
        "sections": {
            "market": clean_text(state.get("market_report")),
            "fundamentals": clean_text(state.get("fundamentals_report")),
            "news": clean_text(state.get("news_report")),
            "sentiment": clean_text(state.get("sentiment_report")),
            "bull_bear": clean_text(investment_state.get("history")),
            "research_verdict": clean_text(state.get("investment_plan")),
            "trader_plan": clean_text(state.get("trader_investment_plan")),
            "risk_debate": clean_text(risk_state.get("history")),
            "risk_verdict": clean_text(risk_state.get("judge_decision")),
        },
    }


FIELD_EVENTS = [
    ("market_report", "analysts", "技术分析师完成", "价格趋势与技术指标已整理"),
    ("sentiment_report", "analysts", "情绪分析师完成", "市场情绪证据已汇总"),
    ("news_report", "analysts", "新闻分析师完成", "公司与宏观新闻已评估"),
    ("fundamentals_report", "analysts", "基本面分析师完成", "财务与估值线索已整理"),
    ("investment_debate_state", "debate", "多空研究进入交叉质询", "看多与看空观点正在互相检验"),
    ("investment_plan", "debate", "研究经理形成判断", "多空证据已合并为研究结论"),
    ("trader_investment_plan", "trader", "交易员提交计划", "入场、退出与仓位条件已生成"),
    ("risk_debate_state", "risk", "风险团队完成压力测试", "激进、中性与保守情景已讨论"),
    ("final_trade_decision", "portfolio", "组合经理完成裁决", "最终评级与执行条件已生成"),
]


def run_analysis(run_id: str, request: AnalysisRequest) -> None:
    ticker = request.ticker.upper().strip()
    try:
        with db() as connection:
            connection.execute("UPDATE runs SET status='running', updated_at=? WHERE id=?", (now_iso(), run_id))
        emit(run_id, "status", "data", "正在确认标的与数据上下文", f"{ticker} · {request.analysis_date}")

        from tradingagents.default_config import DEFAULT_CONFIG
        from tradingagents.graph.trading_graph import TradingAgentsGraph

        config = DEFAULT_CONFIG.copy()
        config["llm_provider"] = os.getenv("TRADINGAGENTS_LLM_PROVIDER", "deepseek")
        config["deep_think_llm"] = os.getenv("TRADINGAGENTS_DEEP_THINK_LLM", "deepseek-v4-pro")
        config["quick_think_llm"] = os.getenv("TRADINGAGENTS_QUICK_THINK_LLM", "deepseek-v4-flash")
        config["output_language"] = "Chinese"
        rounds = {"quick": 1, "standard": 1, "deep": 2}[request.depth]
        config["max_debate_rounds"] = rounds
        config["max_risk_discuss_rounds"] = rounds
        config["checkpoint_enabled"] = True

        graph = TradingAgentsGraph(request.analysts, config=config, debug=False)
        asset_type = "crypto" if ticker.endswith("-USD") else "stock"
        past_context = graph.memory_log.get_past_context(ticker, as_of=graph._memory_as_of(request.analysis_date))
        instrument_context = graph.resolve_instrument_context(ticker, asset_type)
        initial_state = graph.propagator.create_initial_state(
            ticker,
            request.analysis_date,
            asset_type=asset_type,
            past_context=past_context,
            instrument_context=instrument_context,
        )
        args = graph.propagator.get_graph_args()
        completed_fields: set[str] = set()
        final_state: dict[str, Any] = {}

        with graph.checkpoint_scope(ticker, request.analysis_date, asset_type) as checkpoint_id:
            if checkpoint_id:
                args.setdefault("config", {}).setdefault("configurable", {})["thread_id"] = checkpoint_id
            for chunk in graph.graph.stream(graph.checkpoint_input(initial_state), **args):
                final_state.update(chunk)
                for field, stage, title, detail in FIELD_EVENTS:
                    if field in chunk and chunk.get(field) and field not in completed_fields:
                        completed_fields.add(field)
                        emit(run_id, "progress", stage, title, detail, clean_text(chunk.get(field)))

        graph.curr_state = final_state
        graph.ticker = ticker
        graph._log_state(request.analysis_date, final_state)
        graph.clear_checkpoint_on_success(ticker, request.analysis_date, asset_type)
        signal = graph.process_signal(final_state["final_trade_decision"])
        report = build_report(ticker, request.analysis_date, signal, final_state)
        graph.memory_log.store_decision(
            ticker=ticker,
            trade_date=request.analysis_date,
            final_trade_decision=final_state["final_trade_decision"],
        )
        with db() as connection:
            connection.execute(
                "UPDATE runs SET status='completed', signal=?, report_json=?, updated_at=? WHERE id=?",
                (signal, json.dumps(report, ensure_ascii=False), now_iso(), run_id),
            )
        emit(run_id, "complete", "complete", "分析完成", f"{ticker} · {signal}")
    except Exception as exc:
        message = f"{type(exc).__name__}: {exc}"
        with db() as connection:
            connection.execute(
                "UPDATE runs SET status='failed', error=?, updated_at=? WHERE id=?",
                (message, now_iso(), run_id),
            )
        emit(run_id, "error", "error", "分析未完成", message)


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "provider": os.getenv("TRADINGAGENTS_LLM_PROVIDER", "deepseek"),
        "api_key_configured": bool(os.getenv("DEEPSEEK_API_KEY")),
    }


@app.get("/api/runs")
def list_runs() -> list[dict[str, Any]]:
    with db() as connection:
        rows = connection.execute("SELECT * FROM runs ORDER BY created_at DESC LIMIT 30").fetchall()
    return [row_to_run(row) for row in rows]


@app.post("/api/runs", status_code=202)
def create_run(request: AnalysisRequest) -> dict[str, Any]:
    run_id = uuid.uuid4().hex
    timestamp = now_iso()
    with db() as connection:
        connection.execute(
            """INSERT INTO runs
            (id, ticker, analysis_date, depth, cognitive_mode, analysts_json, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 'queued', ?, ?)""",
            (
                run_id,
                request.ticker.upper().strip(),
                request.analysis_date,
                request.depth,
                request.cognitive_mode,
                json.dumps(request.analysts),
                timestamp,
                timestamp,
            ),
        )
    run_events[run_id] = []
    emit(run_id, "status", "queued", "任务已进入研究队列", "正在准备 Agent 团队")
    executor.submit(run_analysis, run_id, request)
    return {"id": run_id, "status": "queued"}


@app.get("/api/runs/{run_id}")
def get_run(run_id: str) -> dict[str, Any]:
    with db() as connection:
        row = connection.execute("SELECT * FROM runs WHERE id=?", (run_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Analysis run not found")
    result = row_to_run(row)
    with event_lock:
        result["events"] = list(run_events.get(run_id, []))
    return result


@app.get("/api/runs/{run_id}/events")
async def stream_run_events(run_id: str) -> StreamingResponse:
    with db() as connection:
        exists = connection.execute("SELECT 1 FROM runs WHERE id=?", (run_id,)).fetchone()
    if not exists:
        raise HTTPException(status_code=404, detail="Analysis run not found")

    async def generator():
        cursor = 0
        while True:
            with event_lock:
                events = list(run_events.get(run_id, []))
            for event in events[cursor:]:
                cursor += 1
                yield f"id: {event['id']}\ndata: {json.dumps(event, ensure_ascii=False)}\n\n"
            with db() as connection:
                row = connection.execute("SELECT status FROM runs WHERE id=?", (run_id,)).fetchone()
            if row and row["status"] in {"completed", "failed"} and cursor >= len(events):
                break
            yield ": keepalive\n\n"
            await asyncio.sleep(1)

    return StreamingResponse(generator(), media_type="text/event-stream")


AGENT_PROMPTS = {
    "personal": "你是用户的个人研究助手。用用户能理解的中文总结专业角色的共识、分歧、未知和失效条件，并在买卖问题中确认持仓状态、周期和风险偏好。不要按 Agent 数量投票。",
    "market": "你是 TradingAgents 的市场分析师，只围绕价格、趋势、成交与技术指标回答，避免把指标表述为确定预测。",
    "sentiment": "你是 TradingAgents 的情绪分析师，分析讨论热度、预期与分歧，但不能把市场情绪当成价格预测。",
    "news": "你是 TradingAgents 的新闻分析师，只围绕公司新闻、公告、宏观事件及其影响路径回答，并说明时效和相关性。",
    "fundamentals": "你是基本面分析师，只围绕财务、估值、商业模式和长期竞争力回答，并区分事实与推断。",
    "research": "你是用户可见的研究员。后台已经由多头研究员、空头研究员和研究经理完成讨论；你要同时呈现支持逻辑、反对逻辑、核心分歧、研究结论和失效条件，不能只选一边。",
    "bull": "你是 TradingAgents 的多头研究员，负责构建最强支持逻辑，但必须说明关键假设、反面证据与证伪条件。",
    "bear": "你是 TradingAgents 的空头研究员，负责挑战看多逻辑，提出最强反例和需要验证的证据。",
    "research_manager": "你是 TradingAgents 的研究经理，评估多空证据，指出关键分歧并形成有条件的研究判断。",
    "trader": "你是 TradingAgents 的交易员，把研究判断转成条件化方案；信息不足时要求补充，不生成无条件仓位或交易指令。",
    "risk": "你是用户可见的风险分析师。后台已经完成激进、中性和保守三种风险讨论；你要汇总乐观、基准、保守情景、最大下行风险和风险结论。",
    "risk_aggressive": "你是 TradingAgents 的激进风险分析师，评估高风险高回报情景，同时明确代价和失效条件。",
    "risk_neutral": "你是 TradingAgents 的中性风险分析师，平衡收益、风险与替代路径，挑战过度乐观和过度保守观点。",
    "risk_conservative": "你是 TradingAgents 的保守风险分析师，优先识别损失、波动、流动性和外部风险。",
    "portfolio_manager": "你是 TradingAgents 的投资组合经理，综合交易方案和风险辩论给出最终有条件裁决，不替用户执行交易。",
}

AGENT_SECTION = {
    "market": "market",
    "sentiment": "sentiment",
    "news": "news",
    "fundamentals": "fundamentals",
    "bull": "bull_bear",
    "bear": "bull_bear",
    "research_manager": "research_verdict",
    "trader": "trader_plan",
    "risk_aggressive": "risk_debate",
    "risk_neutral": "risk_debate",
    "risk_conservative": "risk_debate",
    "portfolio_manager": "risk_verdict",
}


@app.post("/api/chat")
async def chat(request: ChatRequest) -> dict[str, Any]:
    report_context = "尚未关联分析报告。"
    if request.run_id:
        with db() as connection:
            row = connection.execute("SELECT report_json FROM runs WHERE id=?", (request.run_id,)).fetchone()
        if row and row["report_json"]:
            full_report = json.loads(row["report_json"])
            section_key = AGENT_SECTION.get(request.agent)
            if request.agent == "research":
                sections = full_report.get("sections", {})
                role_section = {
                    "多空辩论": sections.get("bull_bear", ""),
                    "研究经理结论": sections.get("research_verdict", ""),
                }
            elif request.agent == "risk":
                sections = full_report.get("sections", {})
                role_section = {
                    "三类风险讨论": sections.get("risk_debate", ""),
                    "风险裁决": sections.get("risk_verdict", ""),
                }
            elif section_key:
                role_section = full_report.get("sections", {}).get(section_key, "")
            else:
                role_section = None

            if role_section is not None:
                report_context = json.dumps(
                    {
                        "ticker": full_report.get("ticker"),
                        "analysis_date": full_report.get("analysis_date"),
                        "signal": full_report.get("signal"),
                        "role_section": role_section,
                        "final_summary": full_report.get("summary", ""),
                    },
                    ensure_ascii=False,
                )[:14000]
            else:
                report_context = row["report_json"][:14000]

    mode_instruction = {
        "beginner": "用户是入门阶段：避免术语堆砌，每个专业词都要解释。",
        "intermediate": "用户是进阶阶段：给出证据、指标含义、正反观点和判断边界。",
        "expert": "用户是专业阶段：保留参数、数据限制、来源线索和关键假设。",
    }[request.cognitive_mode]
    key = os.getenv("DEEPSEEK_API_KEY")
    if not key:
        raise HTTPException(status_code=503, detail="尚未配置 DEEPSEEK_API_KEY")

    def invoke() -> str:
        from openai import OpenAI

        client = OpenAI(api_key=key, base_url="https://api.deepseek.com")
        history_messages = [
            {"role": item.role, "content": item.content}
            for item in request.history[-12:]
        ]
        response = client.chat.completions.create(
            model=os.getenv("TRADINGAGENTS_QUICK_THINK_LLM", "deepseek-v4-flash"),
            messages=[
                {
                    "role": "system",
                    "content": AGENT_PROMPTS[request.agent]
                    + "\n"
                    + mode_instruction
                    + "\n用户上下文："
                    + request.user_context
                    + "\n用户画像只能改变解释顺序、术语、详略和举例，不得改变事实、证据权重或专业结论。"
                    + "\n回答必须依次包含：角色视角、已确认事实、分析推断、相反证据、关键假设、失效条件、置信度与报告依据。不提供隐藏思维链。",
                },
                {"role": "system", "content": "关联研究报告：\n" + report_context},
                *history_messages,
                {"role": "user", "content": request.message},
            ],
            max_tokens=900,
        )
        return response.choices[0].message.content or "暂时没有生成回答。"

    try:
        answer = await asyncio.to_thread(invoke)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Agent 调用失败：{exc}") from exc

    timestamp = now_iso()
    with db() as connection:
        connection.executemany(
            "INSERT INTO chat_messages (id, run_id, agent, role, content, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            [
                (uuid.uuid4().hex, request.run_id, request.agent, "user", request.message, timestamp),
                (uuid.uuid4().hex, request.run_id, request.agent, "assistant", answer, now_iso()),
            ],
        )
    return {"agent": request.agent, "answer": answer}
