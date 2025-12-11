// src/index.js (极简版，包含 fetch 和 scheduled 处理器)

// 🚨 目标 API URL (使用 const 定义，无需 Secret)
const CONSOLE_URL = "https://xxx.run.claw.cloud/api/xxx"; 

// 🚨 从您的 F12 中提取的完整 Cookie 字符串 (使用 const 定义，无需 Secret)
const LOGIN_COOKIE = "_ga=xxx; NEXT_LOCALE=en; _ga_VGVZ0N0QGD=xxx; _ga_61641NFQGV=xxx.run.claw.cloud%2F%22%7D%7D"; 

// 🚨 从您的 F12 中提取的 JWT Token（需要加上 Bearer 前缀）(使用 const 定义，无需 Secret)
const JWT_TOKEN = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxxx.7DRdrWL25aEsvxyGPVIPRdu5rJ8YwJKnboEiQnIHSOw"; 

/**
 * 核心保活函数 (可供 scheduled 和 fetch 调用)
 */
async function performKeepAlive() {
    let success = false;
    let statusText = "";
    
    try {
        const response = await fetch(CONSOLE_URL, {
            method: 'GET',
            headers: {
                'Authorization': JWT_TOKEN, 
                'Cookie': LOGIN_COOKIE,
                'User-Agent': 'ClawCloud-KeepAlive-Worker/2.0',
                'Accept': 'application/json',
            },
        });

        if (response.ok) {
            success = true;
            statusText = `✅ Keep-alive successful! Status: ${response.status}`;
        } else {
            statusText = `❌ Keep-alive failed with status: ${response.status} ${response.statusText}. Check credentials.`;
        }
    } catch (error) {
        statusText = `🚨 An error occurred during fetch: ${error.message}`;
    }
    
    // 无论是定时任务还是手动触发，都将结果打印到 Cloudflare 日志
    console.log(`[${new Date().toISOString()}] Keep-Alive Result: ${statusText}`);

    return { success, statusText };
}

/**
 * Worker 主导出对象
 */
export default {
    // --- 1. 处理定时任务 (Cron Trigger) ---
    async scheduled(controller, env, ctx) {
        ctx.waitUntil(performKeepAlive());
    },

    // --- 2. 处理 Web 请求 (手动触发/预览页面) ---
    async fetch(request, env, ctx) {
        const { success, statusText } = await performKeepAlive();
        
        // 返回一个简单的 JSON 响应，供手动测试或外部监控使用
        const jsonResponse = {
            status: success ? 'OK' : 'ERROR',
            message: statusText,
            timestamp: new Date().toISOString()
        };

        return new Response(JSON.stringify(jsonResponse, null, 2), {
            status: success ? 200 : 500,
            headers: { 
                'Content-Type': 'application/json' 
            },
        });
    }
};
