# 认知交易舱 MVP

TradingAgents 的 Web 投研助手，包含 AI 自选股、个人投研画像、多 Agent 分析、实时进度、可信报告和 Agent 协作室。

## 启动

在项目根目录运行：

```bash
./start-web.sh
```

然后访问 <http://localhost:3000>。

## 服务结构

- Web 前端：`http://localhost:3000`
- 本地 API：`http://127.0.0.1:8000`
- API 文档：`http://127.0.0.1:8000/docs`
- 本地数据库：`backend/trading_copilot.db`（首次启动后创建）

DeepSeek 密钥由项目根目录的 `.env` 读取，不会返回给浏览器。

## Netlify 部署前端

仓库根目录已经包含 `netlify.toml`。在 Netlify 中导入 GitHub 仓库后，构建参数会自动读取：

- Base directory：`web`
- Build command：`npm run build`
- Publish directory：`web/dist`（配置文件内相对路径为 `dist`）

如果已经把 API 部署到公开 HTTPS 地址，在 Netlify 的环境变量中添加：

```text
VITE_API_URL=https://你的后端域名
```

不要把 `DEEPSEEK_API_KEY` 放进 `VITE_API_URL` 或任何以 `VITE_` 开头的变量。`VITE_` 变量会进入浏览器构建产物。DeepSeek Key 只能配置在后端运行环境。

仅部署 Netlify 前端时，预置交互案例、个人画像和协作室案例可以直接演示。实时分析、自定义实时聊天和服务端历史数据需要另行部署 Python API 后才能使用。预置案例在界面中明确标为非实时内容。

后端上线后，还需要在它的环境变量中设置允许访问的前端域名：

```text
FRONTEND_ORIGINS=https://你的站点.netlify.app
```
