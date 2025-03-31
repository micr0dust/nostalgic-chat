// client.js
const loginContainer = document.getElementById('login-container');
const chatContainer = document.getElementById('chat-container');
const nicknameInput = document.getElementById('nickname-input');
const enterButton = document.getElementById('enter-button');
const loginError = document.getElementById('login-error');

const chatMessages = document.getElementById('chat-messages');
const userList = document.getElementById('user-list');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const connectionStatus = document.getElementById('connection-status');

let ws = null;
let nickname = '';

// --- 登入處理 ---
enterButton.addEventListener('click', attemptLogin);
nicknameInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        attemptLogin();
    }
});

function attemptLogin() {
    nickname = nicknameInput.value.trim();
    loginError.textContent = ''; // 清除舊的錯誤訊息

    if (nickname.length < 2) {
        loginError.textContent = '請填寫您的暱稱（至少2個字元）。';
        // alert('請填寫您的暱稱（至少2個字元）。'); // 或者使用 alert
        return;
    }

    // 顯示嘗試連接狀態
    connectionStatus.textContent = '正在連接伺服器...';
    connectWebSocket();
}

// --- WebSocket 連接與處理 ---
function connectWebSocket() {
    // --- 動態生成 WebSocket URL ---
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'; // 判斷是 http 還是 https
    const wsHost = window.location.host; // 使用當前頁面的主機名 (例如 your-project-name.glitch.me)
    const wsUrl = `${wsProtocol}//${wsHost}`; // Glitch 會將 WSS 請求路由到你的應用端口

    console.log(`嘗試連接到: ${wsUrl}`); // 調試輸出

    // --- 重要：移除或註釋掉舊的本地 URL ---
    // const wsUrl = `ws://${window.location.hostname}:8080`; // 舊的本地代碼
    // const wsUrl = 'ws://localhost:8080'; // 舊的本地代碼

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('WebSocket 連接已建立');
        connectionStatus.textContent = '連接成功！正在登入...';
        // 發送登入訊息給伺服器
        if (nickname) { // 確保 nickname 存在
             ws.send(JSON.stringify({ type: 'login', nickname: nickname }));
        } else {
             console.error("嘗試發送登入訊息時暱稱為空");
             handleLoginError("內部錯誤：無法獲取暱稱");
             ws.close();
        }
    };

    // ... (ws.onmessage, ws.onclose, ws.onerror 保持不變) ...
    ws.onclose = (event) => {
        console.log('WebSocket 連接已關閉:', event.reason || `Code: ${event.code}`);
        const reason = event.reason || `Code: ${event.code}`;
        connectionStatus.textContent = `連接已斷開 (${reason})。如需重連請刷新頁面。`;
        messageInput.disabled = true;
        sendButton.disabled = true;
        if (!loginError.textContent && chatContainer.style.display !== 'none') {
            appendMessage('您已與伺服器斷開連接。', 'system');
        }
        // 不自動隱藏聊天介面，讓用戶知道連接斷了
        // hideChatInterface();
        ws = null; // 清除引用
    };

     ws.onerror = (error) => {
        console.error('WebSocket 錯誤:', error);
        const errorMsg = '無法連接到聊天伺服器或連接中斷。請檢查網路或刷新頁面。';
        connectionStatus.textContent = '連接錯誤。';
        if (loginContainer.style.display !== 'none') {
             loginError.textContent = errorMsg;
        } else {
             appendMessage('與伺服器的連接發生錯誤。', 'system');
        }
        // 確保關閉
        if (ws && ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
            ws.close();
        }
        ws = null; // 清除引用
    };
}

function handleLoginError(message) {
    loginError.textContent = message;
    connectionStatus.textContent = '登入失敗。';
    // 確保 ws 連接已關閉
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
    }
    ws = null; // 清除 ws 實例
}


function showChatInterface() {
    loginContainer.style.display = 'none';
    chatContainer.style.display = 'flex'; // 使用 flex 佈局
    messageInput.disabled = false;
    sendButton.disabled = false;
    messageInput.focus(); // 自動聚焦到輸入框
    connectionStatus.textContent = '已連接'; // 更新狀態
}

function hideChatInterface() {
    chatContainer.style.display = 'none';
    loginContainer.style.display = 'block'; // 或 'flex' 取決於你的佈局
    nicknameInput.value = ''; // 清空暱稱輸入
    nickname = '';
    ws = null; // 清除ws實例
     connectionStatus.textContent = ''; // 清空狀態
}


// --- 訊息處理 ---
sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (event) => {
    // 按下 Enter 發送，Shift+Enter 換行
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault(); // 阻止默認的換行行為
        sendMessage();
    }
});

function sendMessage() {
    const messageText = messageInput.value.trim();
    if (messageText && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'message', text: messageText }));
        messageInput.value = ''; // 清空輸入框
    } else if (!ws || ws.readyState !== WebSocket.OPEN) {
        appendMessage('錯誤：未連接到伺服器，無法發送訊息。', 'system');
    }
    messageInput.focus(); // 保持焦點在輸入框
}

// 將訊息附加到聊天視窗
function appendMessage(content, type) {
    const messageElement = document.createElement('div');
    messageElement.classList.add(`message-${type}`); // 添加樣式 class (message-chat 或 message-system)

    // 使用 innerHTML 來渲染 HTML 內容
    // **安全警告**: 這允許用戶輸入的 HTML 被執行，可能存在 XSS 風險。
    // 在生產環境中，應在服務器端或客戶端進行嚴格的 HTML 清理 (Sanitization)。
    // 對於這個懷舊聊天室的特定要求，我們暫時接受這個風險。
    messageElement.innerHTML = content;

    chatMessages.appendChild(messageElement);
    // 自動滾動到底部
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 更新在線用戶列表
function updateUserList(users) {
    userList.innerHTML = ''; // 清空現有列表
    users.forEach(user => {
        const li = document.createElement('li');
        li.textContent = escapeHtml(user); // 顯示用戶名，進行 HTML 轉義以防用戶名包含 HTML
        userList.appendChild(li);
    });
}

// 簡單的 HTML 轉義函數，防止用戶名注入 HTML
function escapeHtml(unsafe) {
    if (!unsafe) return ''; // 處理 null 或 undefined
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}