// server.js
const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const path = require('path'); // 需要 path 模塊來處理文件路徑

// ---- Express 和 HTTP 伺服器設置 ----
const app = express();
const server = http.createServer(app); // 使用 Express App 創建 HTTP 伺服器

// 配置 Express 提供 public 文件夾中的靜態文件
app.use(express.static(path.join(__dirname, 'public')));

// (可選) 根路徑請求也導向 index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---- WebSocket 伺服器設置 ----
// 將 WebSocket 伺服器附加到現有的 HTTP 伺服器上
// 注意：這裡不再指定 port，因為它將使用 HTTP 伺服器的端口
const wss = new WebSocket.Server({ server });

const clients = new Map(); // 使用 Map 來儲存 ws 連線和對應的暱稱

// ---- WebSocket 事件處理邏輯 (與之前基本相同) ----
wss.on('connection', (ws) => {
    console.log('一個客戶端嘗試連接...');
    // (添加 isAlive 屬性用於心跳檢測 - 可選但建議在 Glitch 上使用)
    ws.isAlive = true;
    ws.on('pong', () => {
        ws.isAlive = true; // 收到 pong，標記為存活
    });


    ws.on('message', (message) => {
        // (添加了對二進制數據的檢查，雖然我們主要用 JSON)
        if (message instanceof Buffer) {
           // 嘗試將 Buffer 轉為字串
           message = message.toString();
        }

        // 如果 message 不是字串或為空，則忽略
        if (typeof message !== 'string' || message.trim() === '') {
            console.log('收到空訊息或非文本訊息，忽略。');
            return;
        }


        try {
            const data = JSON.parse(message);
            console.log('收到訊息:', data);

            switch (data.type) {
                case 'login':
                    handleLogin(ws, data.nickname);
                    break;
                case 'message':
                    handleMessage(ws, data.text);
                    break;
                default:
                    console.log('收到未知類型的訊息:', data.type);
            }
        } catch (error) {
            console.error('處理訊息失敗:', error, '原始訊息:', message);
            // ws.send(JSON.stringify({ type: 'error', message: '無效的訊息格式' }));
        }
    });

    ws.on('close', () => {
        handleLogout(ws);
    });

    ws.on('error', (error) => {
        console.error('WebSocket 錯誤:', error);
        handleLogout(ws); // 出錯時也嘗試處理登出
    });
});

function handleLogin(ws, nickname) {
    if (!nickname || typeof nickname !== 'string' || nickname.trim().length < 2) {
        ws.send(JSON.stringify({ type: 'login_error', message: '無效的暱稱。' }));
        ws.close();
        console.log(`無效暱稱，拒絕連接。`);
        return;
    }
    nickname = nickname.trim(); // 去除前後空格

    for (const existingNickname of clients.values()) {
        if (existingNickname === nickname) {
            ws.send(JSON.stringify({ type: 'login_error', message: `暱稱 "${nickname}" 已被使用，請換一個！` }));
            ws.close();
            console.log(`暱稱 ${nickname} 重複，拒絕連接。`);
            return;
        }
    }

    clients.set(ws, nickname);
    console.log(`用戶 "${nickname}" 加入了聊天室`);

    broadcast({
        type: 'system',
        message: `歡迎 "${nickname}" 加入聊天室！`
    });
    broadcastUserList();
     ws.send(JSON.stringify({
        type: 'system',
        message: `您已成功進入聊天室，暱稱為 "${nickname}"`
    }));
}

function handleMessage(ws, text) {
    const nickname = clients.get(ws);
    if (!nickname) {
        console.log('收到來自未登入用戶的訊息，忽略。');
        return;
    }
    if (!text || typeof text !== 'string' || text.trim() === '') {
        return; // 忽略空訊息或非字串訊息
    }

    console.log(`"${nickname}" 說: ${text}`);
    broadcast({
        type: 'chat',
        nickname: nickname,
        message: text
    });
}

function handleLogout(ws) {
    const nickname = clients.get(ws);
    if (nickname) {
        console.log(`用戶 "${nickname}" 離開了聊天室`);
        clients.delete(ws);
        broadcast({
            type: 'system',
            message: `"${nickname}" 離開了聊天室。`
        });
        broadcastUserList();
    } else {
        console.log('一個未登入的客戶端斷開連接。');
    }
}

function broadcast(data) {
    const messageString = JSON.stringify(data);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(messageString, (err) => { // 添加錯誤回調
                if (err) {
                    console.error(`發送訊息給客戶端失敗: ${err}`);
                    // 可以在這裡處理錯誤，例如嘗試移除此客戶端
                    handleLogout(client);
                    client.terminate(); // 強制關閉有問題的連接
                }
            });
        }
    });
}

function broadcastUserList() {
    const userList = Array.from(clients.values());
    broadcast({
        type: 'userlist',
        users: userList
    });
}

// ---- 心跳檢測 (可選但建議) ----
// Glitch 可能會在不活動時休眠連接，心跳有助於保持活躍或檢測死連接
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
        console.log(`客戶端 ${clients.get(ws) || '未知'} 未響應 Ping，終止連接。`);
        handleLogout(ws); // 先處理登出邏輯
        return ws.terminate(); // 終止連接
    }
    ws.isAlive = false; // 假設客戶端已斷開
    ws.ping(() => {}); // 發送 Ping，等待 Pong 回應來設置 isAlive = true
  });
}, 30000); // 每 30 秒檢查一次

wss.on('close', () => {
  clearInterval(interval); // 伺服器關閉時清除定時器
});


// ---- 啟動伺服器 ----
// Glitch 會設置 PORT 環境變量，我們需要監聽它
// 提供一個本地開發的備用端口 (例如 3000)
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`懷舊聊天室伺服器已啟動，正在監聽端口 ${PORT}`);
    console.log(`HTTP服務運行於 http://localhost:${PORT}`);
    console.log(`WebSocket服務附加於同一端口`);
});