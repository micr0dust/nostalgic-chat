// server.js
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });
const clients = new Map(); // 使用 Map 來儲存 ws 連線和對應的暱稱

console.log('懷舊聊天室伺服器已啟動於 ws://localhost:8080');

wss.on('connection', (ws) => {
    console.log('一個客戶端嘗試連接...');

    ws.on('message', (message) => {
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
            console.error('處理訊息失敗:', error);
            // 可以選擇發送錯誤訊息回客戶端或直接關閉連接
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
    // 簡單檢查暱稱是否已被使用 (可選，但建議)
    for (const existingNickname of clients.values()) {
        if (existingNickname === nickname) {
            ws.send(JSON.stringify({ type: 'login_error', message: `暱稱 "${nickname}" 已被使用，請換一個！` }));
            ws.close(); // 關閉重複暱稱的連接
            console.log(`暱稱 ${nickname} 重複，拒絕連接。`);
            return;
        }
    }

    clients.set(ws, nickname); // 將 ws 連線與暱稱關聯起來
    console.log(`用戶 "${nickname}" 加入了聊天室`);

    // 向所有客戶端廣播新用戶加入的系統訊息
    broadcast({
        type: 'system',
        message: `歡迎 "${nickname}" 加入聊天室！`
    });

    // 向所有客戶端廣播更新後的用戶列表
    broadcastUserList();

     // (可選) 向剛登入的用戶發送歡迎訊息
     ws.send(JSON.stringify({
        type: 'system',
        message: `您已成功進入聊天室，暱稱為 "${nickname}"`
    }));
}

function handleMessage(ws, text) {
    const nickname = clients.get(ws);
    if (!nickname) {
        console.log('收到來自未登入用戶的訊息，忽略。');
        return; // 如果發送者未登入（理論上不應發生），則忽略
    }

    if (!text || text.trim() === '') {
        return; // 忽略空訊息
    }

    console.log(`"${nickname}" 說: ${text}`);
    // 向所有客戶端廣播聊天訊息
    broadcast({
        type: 'chat',
        nickname: nickname,
        message: text // 直接傳遞原始文本，讓前端處理 HTML
    });
}

function handleLogout(ws) {
    const nickname = clients.get(ws);
    if (nickname) {
        console.log(`用戶 "${nickname}" 離開了聊天室`);
        clients.delete(ws); // 從 Map 中移除客戶端

        // 向所有剩餘客戶端廣播用戶離開的系統訊息
        broadcast({
            type: 'system',
            message: `"${nickname}" 離開了聊天室。`
        });

        // 向所有剩餘客戶端廣播更新後的用戶列表
        broadcastUserList();
    } else {
        console.log('一個未登入的客戶端斷開連接。');
    }
}

// 廣播訊息給所有連接的客戶端
function broadcast(data) {
    const messageString = JSON.stringify(data);
    // console.log('廣播訊息:', messageString); // 調試用
    wss.clients.forEach((client) => {
        // 只有處於 OPEN 狀態的客戶端才能接收訊息
        if (client.readyState === WebSocket.OPEN) {
            client.send(messageString);
        }
    });
}

// 廣播當前在線用戶列表
function broadcastUserList() {
    const userList = Array.from(clients.values()); // 從 Map 的 values (暱稱) 創建陣列
    broadcast({
        type: 'userlist',
        users: userList
    });
}

// 定期 PING 客戶端以保持連接 (可選，但有助於檢測死連接)
/*
setInterval(() => {
  wss.clients.forEach((client) => {
    if (client.isAlive === false) return client.terminate();
    client.isAlive = false; // 假設死亡，等待 pong 回應
    client.ping(() => {}); // 發送 ping
  });
}, 30000); // 每 30 秒 ping 一次

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true; // 收到 pong，標記為存活
  });
  // ... 其他事件處理器
});
*/