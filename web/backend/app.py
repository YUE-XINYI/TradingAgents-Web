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


class OrderRequest(BaseModel):
    ticker: str = Field(min_length=1, max_length=24, pattern=r"^[A-Za-z0-9.\-^=]+$")
    side: Literal["buy", "sell"]
    quantity: float = Field(gt=0)
    price: float = Field(gt=0)
    linked_run_id: str | None = None
    thesis: str = Field(default="", max_length=600)


class ChatHistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    run_id: str | None = None
    agent: Literal["personal", "fundamentals", "market", "risk", "bear", "bull"] = "personal"
    message: str = Field(min_length=1, max_length=2000)
    cognitive_mode: Literal["beginner", "intermediate", "expert"] = "intermediate"
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
        "assistant_brief": f"多 Agent 团队对 {ticker} 的最终评级为 {signal}。先核对主要证据与风险，再决定是否创建模拟订单。",
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


def portfolio_payload() -> dict[str, Any]:
    with db() as connection:
        account = connection.execute("SELECT * FROM account WHERE id=1").fetchone()
        positions = [dict(row) for row in connection.execute("SELECT * FROM positions ORDER BY ticker")]
        orders = [dict(row) for row in connection.execute("SELECT * FROM orders ORDER BY created_at DESC LIMIT 50")]
    market_value = sum(item["quantity"] * item["last_price"] for item in positions)
    cost = sum(item["quantity"] * item["average_price"] for item in positions)
    total = account["cash"] + market_value
    return {
        "initial_cash": account["initial_cash"],
        "cash": account["cash"],
        "market_value": market_value,
        "total_value": total,
        "total_return": (total / account["initial_cash"] - 1) * 100,
        "unrealized_pnl": market_value - cost,
        "positions": positions,
        "orders": orders,
    }


@app.get("/api/portfolio")
def get_portfolio() -> dict[str, Any]:
    return portfolio_payload()


@app.post("/api/orders", status_code=201)
def create_order(request: OrderRequest) -> dict[str, Any]:
    ticker = request.ticker.upper().strip()
    value = request.quantity * request.price
    with db() as connection:
        account = connection.execute("SELECT cash FROM account WHERE id=1").fetchone()
        position = connection.execute("SELECT * FROM positions WHERE ticker=?", (ticker,)).fetchone()
        if request.side == "buy":
            if account["cash"] < value:
                raise HTTPException(status_code=400, detail="模拟账户可用资金不足")
            old_quantity = position["quantity"] if position else 0
            old_cost = old_quantity * position["average_price"] if position else 0
            new_quantity = old_quantity + request.quantity
            average_price = (old_cost + value) / new_quantity
            connection.execute("UPDATE account SET cash=cash-? WHERE id=1", (value,))
            connection.execute(
                """INSERT INTO positions (ticker, quantity, average_price, last_price, updated_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(ticker) DO UPDATE SET quantity=excluded.quantity,
                average_price=excluded.average_price, last_price=excluded.last_price, updated_at=excluded.updated_at""",
                (ticker, new_quantity, average_price, request.price, now_iso()),
            )
        else:
            if not position or position["quantity"] < request.quantity:
                raise HTTPException(status_code=400, detail="模拟持仓数量不足")
            remaining = position["quantity"] - request.quantity
            connection.execute("UPDATE account SET cash=cash+? WHERE id=1", (value,))
            if remaining <= 0:
                connection.execute("DELETE FROM positions WHERE ticker=?", (ticker,))
            else:
                connection.execute(
                    "UPDATE positions SET quantity=?, last_price=?, updated_at=? WHERE ticker=?",
                    (remaining, request.price, now_iso(), ticker),
                )
        order_id = uuid.uuid4().hex
        connection.execute(
            """INSERT INTO orders
            (id, ticker, side, quantity, price, value, status, linked_run_id, thesis, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 'filled', ?, ?, ?)""",
            (
                order_id,
                ticker,
                request.side,
                request.quantity,
                request.price,
                value,
                request.linked_run_id,
                request.thesis,
                now_iso(),
            ),
        )
    return {"order_id": order_id, "portfolio": portfolio_payload()}


AGENT_PROMPTS = {
    "personal": "你是用户的个人研究助手。根据用户的认知层级，用清楚、诚实、可行动的中文解释专业结论，主动指出不确定性。",
    "fundamentals": "你是基本面分析师，只围绕财务、估值、商业模式和长期竞争力回答，并区分事实与推断。",
    "market": "你是技术与市场分析师，只围绕价格、趋势、成交与技术指标回答，避免把指标表述为确定预测。",
    "risk": "你是风险经理，优先寻找下行风险、流动性风险、仓位风险和论证盲点。",
    "bear": "你是看空研究员，负责挑战现有看多逻辑，提出最强反例和需要验证的证据。",
    "bull": "你是看多研究员，负责寻找上涨驱动，但必须明确触发条件与证伪条件。",
}


@app.post("/api/chat")
async def chat(request: ChatRequest) -> dict[str, Any]:
    report_context = "尚未关联分析报告。"
    if request.run_id:
        with db() as connection:
            row = connection.execute("SELECT report_json FROM runs WHERE id=?", (request.run_id,)).fetchone()
        if row and row["report_json"]:
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
                    + "\n只展示可核验观点、证据、假设和结论摘要，不提供隐藏思维链。",
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
