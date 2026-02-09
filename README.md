# MCSS - Minecraft 服务器分享平台

一个功能全面的 Minecraft 服务器分享和发现平台，使用 React、TypeScript 和 Python FastAPI 构建。

## 功能特性

- 🎮 Minecraft 服务器列表和发现
- 👤 用户认证和个人资料
- 📷 服务器图片上传
- 🏷️ 服务器标签和筛选
- ⭐ 服务器点赞和收藏
- 💬 服务器评论
- 📧 电子邮件验证和密码重置
- 🔍 服务器状态检查
- 🎨 响应式设计，支持深色模式
- 👥 管理员和服务器所有者仪表盘
- 📱 服务器通知系统

## 技术栈

- **前端**: React, TypeScript, Vite, Tailwind CSS
- **后端**: Python, FastAPI, MySQL
- **UI 组件**: Radix UI, Lucide React
- **表单处理**: React Hook Form, Zod
- **路由**: React Router

## 目录结构

```
├── README.md              # 文档
├── LICENSE                # 许可证文件
├── components.json        # UI 组件库配置
├── index.html             # 入口文件
├── package.json           # 包管理
├── postcss.config.js      # PostCSS 配置
├── public                 # 静态资源
│   ├── favicon.ico        # 网站图标
│   └── images             # 图片资源
├── src                    # 前端源代码
│   ├── components         # UI 组件
│   │   ├── common         # 通用组件
│   │   ├── layouts        # 布局组件
│   │   ├── server         # 服务器相关组件
│   │   └── ui             # UI 组件
│   ├── contexts           # React 上下文
│   ├── db                 # API 客户端配置
│   ├── hooks              # 自定义钩子
│   ├── lib                # 工具函数
│   ├── pages              # 应用页面
│   ├── services           # API 服务
│   ├── types              # TypeScript 类型
│   ├── App.tsx            # 主应用组件
│   ├── main.tsx           # 应用入口
│   ├── routes.tsx         # 路由配置
│   └── index.css          # 全局样式
├── backend                # 后端源代码
│   ├── app                # 应用代码
│   │   ├── api            # API 端点
│   │   ├── auth           # 认证
│   │   ├── config         # 配置
│   │   ├── schemas        # 数据模式
│   │   ├── services       # 服务
│   │   └── utils          # 工具函数
│   ├── uploads            # 上传的文件
│   │   └── images         # 上传的图片
│   ├── init_db.py         # 数据库初始化
│   ├── init_db.sql        # 数据库模式
│   ├── main.py            # 后端入口点
│   └── requirements.txt   # Python 依赖
├── .env.production        # 生产环境变量
├── .gitignore             # Git 忽略文件
├── DEPLOYMENT.md          # 部署文档
├── biome.json             # Biome 配置
├── build.sh               # 构建脚本
├── pnpm-lock.yaml         # pnpm 锁定文件
├── pnpm-workspace.yaml    # pnpm 工作区配置
├── tailwind.config.js     # Tailwind CSS 配置
├── tsconfig.app.json      # 应用的 TypeScript 配置
├── tsconfig.check.json    # 检查的 TypeScript 配置
├── tsconfig.json          # TypeScript 配置
├── tsconfig.node.json     # Node 的 TypeScript 配置
├── vite.config.dev.ts     # 开发环境的 Vite 配置
└── vite.config.ts         # Vite 配置
```

## 开始使用

### 先决条件

- Node.js ≥ 20
- npm ≥ 10 或 pnpm ≥ 8
- Python ≥ 3.10
- MySQL ≥ 8.0

### 本地开发

1. **克隆仓库**
   ```bash
   git clone https://github.com/live-ling/mcss.git
   cd mcss
   ```

2. **安装前端依赖**
   ```bash
   npm install
   # 或
   pnpm install
   ```

3. **设置前端环境变量**
   在根目录创建 `.env` 文件：
   ```env
   VITE_API_BASE_URL=http://localhost:8000/api
   ```

4. **设置后端环境**
   ```bash
   cd backend
   python -m venv venv
   venv\Scripts\activate  # Windows
   # source venv/bin/activate  # macOS/Linux
   pip install -r requirements.txt
   ```

5. **配置后端环境变量**
   在后端目录创建 `.env` 文件：
   ```env
   # 数据库配置
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your-password
   DB_NAME=mcss

   # JWT 配置
   SECRET_KEY=your-secret-key-here
   ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=30
   REFRESH_TOKEN_EXPIRE_DAYS=7

   # 应用配置
   APP_NAME=MCSS
   APP_VERSION=1.0.0
   DEBUG=True

   # 文件上传配置
   UPLOAD_DIR=uploads
   MAX_UPLOAD_SIZE=5242880

   # SMTP 配置（可选）
   # SMTP_HOST=smtp.example.com
   # SMTP_PORT=587
   # SMTP_USERNAME=your-email@example.com
   # SMTP_PASSWORD=your-email-password
   # SMTP_FROM_EMAIL=your-email@example.com
   # SMTP_FROM_NAME=MCSS
   # SMTP_USE_TLS=True
   ```

6. **初始化数据库**
   ```bash
   python init_db.py
   ```

7. **启动后端服务器**
   ```bash
   python main.py
   ```

8. **启动前端开发服务器**
   ```bash
   cd ..
   npm run dev
   # 或
   pnpm dev
   ```

## 部署

### 部署到 GitHub

1. **创建 GitHub 仓库**
   - 前往 [GitHub](https://github.com/new) 并创建一个新的仓库
   - 将代码推送到仓库：
     ```bash
     git remote add origin https://github.com/your-username/mcss.git
     git add .
     git commit -m "Initial commit"
     git push -u origin main
     ```

### 前端部署

你可以将前端部署到任何静态托管服务，如 Cloudflare Pages、Vercel 或 Netlify。

#### 示例：Cloudflare Pages

1. **连接到 Cloudflare Pages**
   - 前往 [Cloudflare Pages](https://pages.cloudflare.com/)
   - 点击 "Create a project"
   - 连接你的 GitHub 仓库

2. **配置构建设置**
   - **Framework preset**: React
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `/`

3. **设置环境变量**
   - 添加以下环境变量：
     - `VITE_API_BASE_URL` - 你的后端 API URL

4. **部署**
   - 点击 "Save and Deploy"
   - 等待部署完成

### 后端部署

你可以将后端部署到任何 Python 托管服务，如 AWS、GCP、Azure 或 VPS。

#### 示例：VPS 部署

1. **设置服务器**
   - 安装 Python、MySQL 和 Nginx
   - 创建 MySQL 数据库和用户

2. **部署代码**
   - 将仓库克隆到你的服务器
   - 安装依赖
   - 配置 `.env` 文件
   - 初始化数据库

3. **设置 Gunicorn 和 Nginx**
   - 安装 Gunicorn
   - 为你的后端创建一个 systemd 服务
   - 配置 Nginx 作为反向代理

## 数据库配置

数据库模式定义在 `backend/init_db.sql` 文件中。这个文件包含了应用所需的所有表。

### 表

- `users` - 用户账户
- `profiles` - 用户个人资料
- `servers` - Minecraft 服务器
- `server_images` - 服务器图片
- `server_tags` - 服务器标签
- `server_likes` - 服务器点赞
- `server_favorites` - 服务器收藏
- `server_comments` - 服务器评论
- `server_reports` - 服务器举报
- `server_notification_configs` - 服务器通知配置
- `server_notification_records` - 服务器通知记录
- `smtp_config` - 邮件的 SMTP 配置
- `email_templates` - 邮件模板
- `verification_codes` - 验证码
- `server_edit_requests` - 服务器编辑请求
- `site_settings` - 站点设置

## 环境变量

### 前端

| 变量 | 描述 | 是否必需 |
|------|------|----------|
| `VITE_API_BASE_URL` | API 基础 URL | 是 |

### 后端

| 变量 | 描述 | 是否必需 |
|------|------|----------|
| `DB_HOST` | 数据库主机 | 是 |
| `DB_PORT` | 数据库端口 | 是 |
| `DB_USER` | 数据库用户 | 是 |
| `DB_PASSWORD` | 数据库密码 | 是 |
| `DB_NAME` | 数据库名称 | 是 |
| `SECRET_KEY` | JWT 密钥 | 是 |
| `ALGORITHM` | JWT 算法 | 否（默认: HS256） |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 访问令牌过期时间 | 否（默认: 30） |
| `REFRESH_TOKEN_EXPIRE_DAYS` | 刷新令牌过期时间 | 否（默认: 7） |
| `APP_NAME` | 应用名称 | 否（默认: MCSS） |
| `APP_VERSION` | 应用版本 | 否（默认: 1.0.0） |
| `DEBUG` | 调试模式 | 否（默认: True） |
| `UPLOAD_DIR` | 上传目录 | 否（默认: uploads） |
| `MAX_UPLOAD_SIZE` | 最大上传大小 | 否（默认: 5MB） |
| `SMTP_HOST` | SMTP 服务器主机 | 否 |
| `SMTP_PORT` | SMTP 服务器端口 | 否 |
| `SMTP_USERNAME` | SMTP 用户名 | 否 |
| `SMTP_PASSWORD` | SMTP 密码 | 否 |
| `SMTP_FROM_EMAIL` | 发件人邮箱地址 | 否 |
| `SMTP_FROM_NAME` | 发件人名称 | 否 |
| `SMTP_USE_TLS` | 使用 TLS | 否（默认: True） |

## 贡献

欢迎贡献！请随时提交 Pull Request。

### 开发指南

1. Fork 仓库
2. 创建一个功能分支
3. 提交你的更改
4. 推送到分支
5. 打开一个 Pull Request

## 许可证

本项目使用自定义许可证，基于 MIT 许可证修改，允许自由使用、修改和分发，但禁止未经许可的商用。详情请参阅 [LICENSE](LICENSE) 文件。

## 关于 AI 开发

本项目借助 AI 技术开发，旨在为 Minecraft 服务器社区提供一个功能全面的分享平台。

## 致谢

- [Radix UI](https://www.radix-ui.com/) 提供的 UI 组件
- [Tailwind CSS](https://tailwindcss.com/) 提供的样式
- [Lucide React](https://lucide.dev/) 提供的图标
- [FastAPI](https://fastapi.tiangolo.com/) 提供的后端框架
- [React](https://react.dev/) 提供的前端库
- [TypeScript](https://www.typescriptlang.org/) 提供的类型安全
- [UApiPro](https://uapis.cn/) 提供免费、稳定、快速的公共 API

## 支持

如果你有任何问题或疑问，请在 GitHub 上打开一个 issue 或联系维护者。

---

