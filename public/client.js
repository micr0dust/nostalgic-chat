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
    // --- 重要：請根據你的伺服器地址修改 ---
    // 如果伺服器在本機運行，通常是 'ws://localhost:8080'
    // 如果部署到伺服器，則需要換成 'ws://your-server-address:port' 或 'wss://your-secure-server-address'
    const wsUrl = `ws://${window.location.hostname}:8080`; // 自動偵測主機名
    // const wsUrl = 'ws://localhost:8080'; // 或者直接指定

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('WebSocket 連接已建立');
        connectionStatus.textContent = '連接成功！正在登入...';
        // 發送登入訊息給伺服器
        ws.send(JSON.stringify({ type: 'login', nickname: nickname }));
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log('收到伺服器訊息:', data); // 調試用

            switch (data.type) {
                case 'login_error': // 處理登入錯誤 (例如暱稱重複)
                    handleLoginError(data.message);
                    break;
                case 'system':
                    appendMessage(data.message, 'system');
                    // 檢查是否是自己的登入成功訊息
                    if (data.message.includes(`您已成功進入聊天室，暱稱為 "${nickname}"`)) {
                         showChatInterface(); // 只有在確認登入成功後才顯示聊天介面
                    }
                    break;
                case 'chat':
                    appendMessage(`<strong>${escapeHtml(data.nickname)}:</strong> ${data.message}`, 'chat');
                    break;
                case 'userlist':
                    updateUserList(data.users);
                    break;
                 case 'error': // 處理伺服器發來的其他錯誤
                    console.error('伺服器錯誤:', data.message);
                    appendMessage(`伺服器錯誤: ${escapeHtml(data.message)}`, 'system');
                    break;
                default:
                    console.log('收到未知類型的訊息:', data.type);
            }
        } catch (error) {
            console.error('處理伺服器訊息失敗:', error);
            appendMessage('收到無法解析的訊息', 'system');
        }
    };

    ws.onclose = (event) => {
        console.log('WebSocket 連接已關閉:', event.reason || `Code: ${event.code}`);
        connectionStatus.textContent = `連接已斷開 (${event.reason || `Code: ${event.code}`})。請重新整理頁面。`;
        // 可以在這裡禁用輸入框和發送按鈕
        messageInput.disabled = true;
        sendButton.disabled = true;
        // 如果不是因為登入錯誤而關閉，則顯示聊天介面已斷開
        if (!loginError.textContent) { // 避免覆蓋登入錯誤
            appendMessage('您已與伺服器斷開連接。', 'system');
        }
        // 可以選擇隱藏聊天介面，顯示登入介面
        // hideChatInterface();
    };

    ws.onerror = (error) => {
        console.error('WebSocket 錯誤:', error);
        connectionStatus.textContent = '連接錯誤，請檢查伺服器是否運行或網路連線。';
        // 如果尚未登入成功，顯示在登入錯誤區
        if (loginContainer.style.display !== 'none') {
             loginError.textContent = '無法連接到聊天伺服器。';
        } else {
             appendMessage('與伺服器的連接發生錯誤。', 'system');
        }
        // 關閉可能存在的 ws 連接
        if (ws && ws.readyState !== WebSocket.CLOSED) {
            ws.close();
        }
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