-----
# 🚀 Koyebne - ENC+Vioion-WS-TLS-CDN 代理节点

[](https://github.com/justlagom/koyebne)
[](https://www.google.com/search?q=https://app.koyeb.com/deploy%3Fname%3Dkoyebne%26type%3Dgit%26repository%3Dgithub.com/justlagom/koyebne%26branch%3Dmain%26env%5BENC_CONFIG%5D%3D)

一个部署在 [Koyeb Serverless Platform](https://www.koyeb.com/) 上的 **ENC+Vioion-WS** 代理节点项目，旨在提供一个稳定、快速的代理服务。

该项目利用 Koyeb 的持续运行能力，并通过部署在 Cloudflare Workers 的 `worker.js` 文件实现远程登录保活，确保服务的持久可用性。

## ✨ 主要特性

  * **多协议支持:** 集成了 **ENC**、**Vioion**、**WS** 和 **ARGO** 代理协议。
  * **平台稳定:** 部署在 Koyeb 平台，享受其高性能和全球边缘网络。
  * **远程保活:** 通过 Cloudflare Worker 定时访问，解决 Koyeb 可能出现的休眠或回收问题。

## ⚙️ 部署指南 (Koyeb)

### 步骤 1: 准备环境变量

## koyebne/app/xy/config.json-可选择手搓其他xray配置
默认节点样板
vless://%E5%A1%AB%E5%85%A5UUID@填入优选ip/域名:443?encryption=mlkem768x25519plus.native.0rtt.fRLKjkBNx1N6ceiqcqilb46WNj4yvl4SgXklAFkvNhE&flow=xtls-rprx-vision&security=tls&sni=%E5%A1%AB%E5%85%A5%E5%9B%BA%E5%AE%9A%E9%9A%A7%E9%81%93%E5%9F%9F%E5%90%8D&fp=chrome&alpn=http%2F1.1&insecure=0&allowInsecure=0&type=ws&path=%2Fb3a053a4#US%2FDE%20ENC-Vision-WS%EF%BC%88Koyeb%EF%BC%89

在部署到 Koyeb 之前，您需要设置核心的代理配置参数**uuid**，也可手搓更改xray配置文件。

| 变量名 | 描述 | 示例值 |
| :--- | :--- | :--- |
| **`CLOUDFLARED_TOKEN`** | 必备 | `设置cf tunel时获取token` |
| **`UUID`** | 自定义uuid-必需。 | `5936acb6-e65e-4631-bedf-ce723a1a375d` |
| **`DOMAIN`** | 域名(首次部署后可见)-必需。 | `xxx.koyeb.app` |

### 步骤 2: 一键部署

点击下方的 Koyeb 部署按钮，系统将自动跳转到 Koyeb 部署页面：

[](https://www.google.com/search?q=https://app.koyeb.com/deploy%3Fname%3Dkoyebne%26type%3Dgit%26repository%3Dgithub.com/justlagom/koyebne%26branch%3Dmain%26env%5BENC_CONFIG%5D%3D)

1.  **Sources:** 填写docker镜像地址 `ghcr.io/xxx/xxx`（建议fork后创建自己的docker镜像）。
2.  **Environment variables and files:** 填入您准备好的 **`ENC_CONFIG`** 值。（UUID，DOMAIN）
3.  **Instance:** 选择CPU Eco免费DE&US。
4.  **Ports:** 需要开启一个7860默认暴露端口（开启**Public HTTPS access**），一个xray配置中自定义端口（可不开启 **Public HTTPS access** ）
5.  点击 **"Deploy"** 完成部署。

部署完成后，记下 Koyeb 分配给您的服务 **URL**，例如 `https://koyebne-xxxxx.koyeb.app`，这个 URL 将用于后续的保活配置。

## 💡 Worker 保活机制 (Cloudflare)

为了确保 Koyeb 部署的服务不会因长时间不活跃而被休眠或回收，我们提供了 `worker.js` 文件，可部署到 Cloudflare Workers 实现定时访问保活。

### 步骤 1: 部署 Cloudflare Worker

1.  创建一个新的 Cloudflare Worker。
2.  将本项目中的 `worker.js` 文件内容复制并粘贴到您的 Worker 代码中。

### 步骤 2: 配置 Worker 环境变量

在 Cloudflare Worker 的设置中，您需要配置以下环境变量：

| 变量名 | 描述 | 示例值 |
| :--- | :--- | :--- |
| **`TARGET_URL`** | 您在 Koyeb 部署的服务 URL。 | `https://koyebne-xxxxx.koyeb.app` |
| **`AUTH_TOKEN`** | 用于 Worker 身份验证的密钥。**自行获取koyeb账户所提供的token** | `your-token` |

### 步骤 3: 配置 Koyeb 保活 Token

回到 Koyeb 服务的环境变量设置，增加一个新的环境变量，用于验证 Worker 的访问请求：

| 变量名 | 描述 | 示例值 |
| :--- | :--- | :--- |
| **`WORKER_TOKEN`** | 必须与您在 Cloudflare Worker 中设置的 `AUTH_TOKEN` **完全一致**。 | `your-token` |

### 步骤 4: 配置 Worker 定时任务 (Cron Trigger)

在 Cloudflare Worker 的设置中，配置 **Cron Trigger** (定时任务)，例如每隔 **5 分钟** 触发一次。

  * **Cron 表达式示例 (每 5 分钟):** `*/5 * * * *`

### 🔄 保活流程

1.  Cloudflare Worker 定时被 Cron Trigger 触发。
2.  Worker 向 Koyeb 服务的 `TARGET_URL` 发送一个带有 `X-Worker-Token` 请求头的请求。
3.  Koyeb 服务接收到请求，验证 `X-Worker-Token` 是否与 `WORKER_TOKEN` 匹配。
4.  验证通过，服务保持活跃。

## 🛠️ 本地开发

```bash
# 克隆项目
git clone https://github.com/justlagom/koyebne.git
cd koyebne

# 安装依赖 (假设您使用 Node.js)
# npm install

# 运行服务 (根据您的实际代码运行方式)
# node index.js
```

-----

## 📄 License

该项目基于 **MIT License** 发布。

-----

希望这份 README 对您有所帮助！
