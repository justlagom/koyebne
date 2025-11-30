/**
 * Koyeb Keep-Alive Worker with Dashboard
 * * 环境变量 (Environment Variables):
 * - KOYEB_TOKEN: (必填) Koyeb API Token
 * - KOYEB_APP_URL: (可选) 你的 App URL，用于 HTTP Ping
 * * KV 命名空间绑定 (可选):
 * - LOG_KV: 用于存储历史日志，绑定名为 LOG_KV
 */

const CONFIG = {
  VERSION: '1.2.0',
  LOG_LIMIT: 20 // 保存最近多少条日志
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 路由处理
    if (url.pathname === '/api/trigger') {
      return await handleTrigger(env);
    } else if (url.pathname === '/api/logs') {
      return await handleGetLogs(env);
    }

    // 默认返回 Dashboard 页面
    return new Response(getHtml(env), {
      headers: { 'Content-Type': 'text/html;charset=UTF-8' },
    });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(keepAlive(env, 'Cron Scheduled'));
  },
};

/**
 * 核心保活逻辑
 */
async function keepAlive(env, source = 'Manual') {
  const logs = [];
  const timestamp = new Date().toISOString();
  let success = true;

  logs.push(`[${timestamp}] 🚀 任务开始 (来源: ${source})`);

  // 1. 检查 Token
  if (!env.KOYEB_TOKEN) {
    logs.push(`[${timestamp}] ❌ 错误: 未检测到 KOYEB_TOKEN 环境变量。请在设置中配置。`);
    await saveLogs(env, logs, false);
    return { success: false, logs };
  }

  // 2. 请求 Koyeb API (模拟登录/活跃)
  try {
    const start = Date.now();
    const response = await fetch('https://app.koyeb.com/v1/account/profile', {
      headers: {
        'Authorization': `Bearer ${env.KOYEB_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    const duration = Date.now() - start;

    if (response.ok) {
      const data = await response.json();
      logs.push(`[${timestamp}] ✅ Koyeb API 验证成功 (${duration}ms) - 用户: ${data.user?.email || 'Unknown'}`);
    } else {
      success = false;
      logs.push(`[${timestamp}] ❌ Koyeb API 失败: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    success = false;
    logs.push(`[${timestamp}] ❌ Koyeb API 请求异常: ${error.message}`);
  }

  // 3. (可选) Ping 应用 URL
  if (env.KOYEB_APP_URL) {
    try {
      const start = Date.now();
      const res = await fetch(env.KOYEB_APP_URL);
      const duration = Date.now() - start;
      logs.push(`[${timestamp}] 🌐 App Ping: ${res.status} (${duration}ms)`);
    } catch (e) {
      logs.push(`[${timestamp}] ⚠️ App Ping 失败: ${e.message}`);
    }
  }

  // 保存日志
  await saveLogs(env, logs, success);
  
  return { success, logs };
}

/**
 * 手动触发处理
 */
async function handleTrigger(env) {
  const result = await keepAlive(env, 'Web Dashboard');
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * 获取日志处理
 */
async function handleGetLogs(env) {
  let history = [];
  if (env.LOG_KV) {
    try {
      const data = await env.LOG_KV.get('history');
      if (data) history = JSON.parse(data);
    } catch (e) {
      // 忽略 KV 读取错误
    }
  }
  return new Response(JSON.stringify(history), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * 保存日志到 KV (如果存在)
 */
async function saveLogs(env, newLogs, status) {
  if (!env.LOG_KV) return;

  try {
    let history = [];
    const existing = await env.LOG_KV.get('history');
    if (existing) history = JSON.parse(existing);

    // 构建日志对象
    const logEntry = {
      time: new Date().toISOString(),
      status: status ? 'success' : 'error',
      messages: newLogs
    };

    // 添加新日志到头部
    history.unshift(logEntry);

    // 限制日志数量
    if (history.length > CONFIG.LOG_LIMIT) {
      history = history.slice(0, CONFIG.LOG_LIMIT);
    }

    await env.LOG_KV.put('history', JSON.stringify(history));
    
    // 更新最后运行时间
    await env.LOG_KV.put('last_run', new Date().toISOString());
  } catch (e) {
    console.error('KV Save Error:', e);
  }
}

/**
 * 生成 HTML Dashboard
 */
function getHtml(env) {
  const hasToken = !!env.KOYEB_TOKEN;
  const hasKV = !!env.LOG_KV;
  
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Koyeb Keep-Alive Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
  <style>
    body { background-color: #0f172a; color: #e2e8f0; font-family: 'Segoe UI', system-ui, sans-serif; }
    .glass { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.1); }
    .status-dot { height: 10px; width: 10px; border-radius: 50%; display: inline-block; }
    .animate-pulse-slow { animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
    
    /* Scrollbar */
    ::-webkit-scrollbar { width: 8px; }
    ::-webkit-scrollbar-track { background: #1e293b; }
    ::-webkit-scrollbar-thumb { background: #475569; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #64748b; }
  </style>
</head>
<body class="min-h-screen flex flex-col items-center py-10 px-4">

  <!-- Header -->
  <div class="w-full max-w-4xl mb-8 flex justify-between items-center">
    <div class="flex items-center gap-3">
      <div class="p-3 bg-blue-600 rounded-lg shadow-lg shadow-blue-500/30">
        <i class="fa-solid fa-server text-white text-xl"></i>
      </div>
      <div>
        <h1 class="text-2xl font-bold text-white tracking-tight">Koyeb 保活助手</h1>
        <p class="text-slate-400 text-sm">Cloudflare Worker 部署版 v${CONFIG.VERSION}</p>
      </div>
    </div>
    <a href="https://github.com/justlagom/koyeb-keepalive-worker" target="_blank" class="text-slate-400 hover:text-white transition">
      <i class="fa-brands fa-github text-2xl"></i>
    </a>
  </div>

  <div class="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-6">
    
    <!-- Left Column: Status & Controls -->
    <div class="md:col-span-1 space-y-6">
      
      <!-- Status Card -->
      <div class="glass rounded-xl p-6 shadow-xl relative overflow-hidden group">
        <div class="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition">
          <i class="fa-solid fa-heart-pulse text-6xl text-blue-500"></i>
        </div>
        <h2 class="text-sm uppercase tracking-wider text-slate-400 font-semibold mb-4">系统状态</h2>
        
        <div class="space-y-4">
          <div class="flex justify-between items-center">
            <span class="text-slate-300">环境变量配置</span>
            ${hasToken 
              ? '<span class="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded border border-green-500/30">已配置</span>' 
              : '<span class="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded border border-red-500/30">缺少 Token</span>'}
          </div>
          <div class="flex justify-between items-center">
            <span class="text-slate-300">日志数据库 (KV)</span>
            ${hasKV 
              ? '<span class="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded border border-green-500/30">已连接</span>' 
              : '<span class="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded border border-yellow-500/30">未绑定</span>'}
          </div>
        </div>
      </div>

      <!-- Action Card -->
      <div class="glass rounded-xl p-6 shadow-xl">
        <h2 class="text-sm uppercase tracking-wider text-slate-400 font-semibold mb-4">操作</h2>
        <button id="runBtn" onclick="triggerKeepAlive()" class="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold py-3 px-4 rounded-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2">
          <i class="fa-solid fa-bolt"></i> 立即运行保活
        </button>
        <p class="text-xs text-slate-500 mt-3 text-center">
          定时任务由 Cloudflare Cron Triggers 控制
        </p>
      </div>

    </div>

    <!-- Right Column: Logs -->
    <div class="md:col-span-2">
      <div class="glass rounded-xl p-6 shadow-xl h-full flex flex-col min-h-[400px]">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-sm uppercase tracking-wider text-slate-400 font-semibold">运行日志</h2>
          <button onclick="loadLogs()" class="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
            <i class="fa-solid fa-rotate-right"></i> 刷新
          </button>
        </div>
        
        <!-- Log Container -->
        <div id="logContainer" class="flex-1 bg-slate-900/50 rounded-lg p-4 overflow-y-auto font-mono text-sm border border-white/5 relative">
          <div class="absolute inset-0 flex items-center justify-center text-slate-600 pointer-events-none" id="emptyState">
            等待数据...
          </div>
          <div id="logContent" class="space-y-3"></div>
        </div>
      </div>
    </div>

  </div>

  <footer class="mt-12 text-slate-600 text-sm">
    <p>Powered by Cloudflare Workers</p>
  </footer>

  <script>
    const logContent = document.getElementById('logContent');
    const emptyState = document.getElementById('emptyState');
    const runBtn = document.getElementById('runBtn');

    // 格式化时间
    function formatTime(isoString) {
      const date = new Date(isoString);
      return date.toLocaleTimeString() + ' ' + date.toLocaleDateString();
    }

    // 渲染单条日志
    function createLogItem(entry) {
      const isSuccess = entry.status === 'success';
      const icon = isSuccess ? 'fa-check-circle text-green-500' : 'fa-times-circle text-red-500';
      const borderClass = isSuccess ? 'border-l-green-500/50' : 'border-l-red-500/50';
      
      let html = \`
        <div class="bg-slate-800/50 rounded p-3 border-l-4 \${borderClass} animate-fade-in">
          <div class="flex items-center gap-2 mb-1">
            <i class="fa-solid \${icon}"></i>
            <span class="text-xs text-slate-400">\${formatTime(entry.time)}</span>
          </div>
          <div class="pl-6 space-y-1">
      \`;
      
      entry.messages.forEach(msg => {
        // 简单的高亮处理
        let coloredMsg = msg
          .replace(/✅/g, '<span class="text-green-400">✅</span>')
          .replace(/❌/g, '<span class="text-red-400">❌</span>')
          .replace(/\\[(.*?)\\]/, '<span class="text-slate-500">[$1]</span>');
        html += \`<div class="text-slate-300 break-all">\${coloredMsg}</div>\`;
      });

      html += \`</div></div>\`;
      return html;
    }

    // 加载日志
    async function loadLogs() {
      try {
        const res = await fetch('/api/logs');
        const data = await res.json();
        
        logContent.innerHTML = '';
        if (data && data.length > 0) {
          emptyState.style.display = 'none';
          data.forEach(entry => {
            logContent.innerHTML += createLogItem(entry);
          });
        } else {
          emptyState.style.display = 'flex';
          emptyState.innerText = '${hasKV ? "暂无历史记录" : "未绑定 KV，仅显示实时运行日志"}';
        }
      } catch (e) {
        console.error(e);
      }
    }

    // 触发保活
    async function triggerKeepAlive() {
      const originalText = runBtn.innerHTML;
      runBtn.disabled = true;
      runBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> 运行中...';
      runBtn.classList.add('opacity-75');

      try {
        const res = await fetch('/api/trigger');
        const data = await res.json();
        
        // 构造一个临时的日志条目显示在最上方
        const tempEntry = {
          time: new Date().toISOString(),
          status: data.success ? 'success' : 'error',
          messages: data.logs
        };
        
        emptyState.style.display = 'none';
        const newItem = createLogItem(tempEntry);
        logContent.insertAdjacentHTML('afterbegin', newItem);
        
      } catch (e) {
        alert('触发失败: ' + e.message);
      } finally {
        runBtn.disabled = false;
        runBtn.innerHTML = originalText;
        runBtn.classList.remove('opacity-75');
      }
    }

    // 页面加载时尝试获取日志
    ${hasKV ? 'loadLogs();' : ''}
  </script>
</body>
</html>
  `;
}
