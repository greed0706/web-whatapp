import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3002';
const socket = io(SERVER_URL);

const getColor = (name) => {
    const colors = ['#25D366', '#128C7E', '#075E54', '#34B7F1', '#ECE5DD', '#DCF8C6'];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return colors[Math.abs(h) % colors.length];
};
const initials = (n) => n.slice(0, 2).toUpperCase();

function App() {
    const [username, setUsername] = useState('');
    const [joined, setJoined] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [typingUser, setTypingUser] = useState(null);
    const [selectedChat, setSelectedChat] = useState(null);
    const endRef = useRef(null);
    const timerRef = useRef(null);

    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    useEffect(() => {
        socket.on('new_message', (msg) => setMessages((p) => [...p, msg]));
        socket.on('user_joined', (d) => {
            setOnlineUsers(d.users);
            setMessages((p) => [...p, { id: Date.now(), type: 'system', text: `${d.username} đã tham gia` }]);
        });
        socket.on('user_left', (d) => {
            setOnlineUsers(d.users);
            if (d.username) setMessages((p) => [...p, { id: Date.now(), type: 'system', text: `${d.username} đã rời` }]);
        });
        socket.on('user_typing', ({ username: u, isTyping }) => setTypingUser(isTyping ? u : null));
        return () => { socket.off('new_message'); socket.off('user_joined'); socket.off('user_left'); socket.off('user_typing'); };
    }, []);

    const handleLogin = (e) => {
        e.preventDefault();
        if (username.trim()) {
            socket.emit('join', username.trim());
            setJoined(true);
            setSelectedChat('Group Chat');
        }
    };

    const handleSend = (e) => {
        e.preventDefault();
        if (input.trim()) { socket.emit('send_message', { text: input.trim() }); setInput(''); socket.emit('typing', false); }
    };

    const handleTyping = (e) => {
        setInput(e.target.value);
        socket.emit('typing', true);
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => socket.emit('typing', false), 1000);
    };

    const fmt = (ts) => new Date(ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    if (!joined) {
        return (
            <div className="login-screen">
                <div className="login-logo">
                    <div className="logo-circle">💬</div>
                    <h1>WebChat</h1>
                    <p>Nhắn tin nhanh, kết nối bền vững</p>
                </div>
                <form className="login-form" onSubmit={handleLogin}>
                    <input
                        className="login-input"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        placeholder="Nhập tên của bạn..."
                        autoFocus
                    />
                    <button type="submit" className="login-btn">BẮT ĐẦU →</button>
                </form>
            </div>
        );
    }

    return (
        <div className="app">
            {/* Left - Chat List */}
            <aside className="chat-list">
                <div className="chat-list-header">
                    <div className="search-bar">
                        <span>🔍</span>
                        <input placeholder="Tìm kiếm..." />
                    </div>
                </div>
                <div className="chat-list-tabs">
                    <button className="tab active">Tất cả</button>
                    <button className="tab">Chưa đọc</button>
                    <button className="tab">Nhóm</button>
                </div>
                <div
                    className={`chat-item ${selectedChat === 'Group Chat' ? 'active' : ''}`}
                    onClick={() => setSelectedChat('Group Chat')}
                >
                    <div className="chat-item-avatar group">👥</div>
                    <div className="chat-item-info">
                        <div className="chat-item-name">Group Chat</div>
                        <div className="chat-item-preview">
                            {messages.filter(m => m.type !== 'system').slice(-1)[0]?.text || 'Chưa có tin nhắn'}
                        </div>
                    </div>
                    <div className="chat-item-meta">
                        <div className="chat-item-time">
                            {messages.filter(m => m.type !== 'system').slice(-1)[0]
                                ? fmt(messages.filter(m => m.type !== 'system').slice(-1)[0].timestamp)
                                : ''}
                        </div>
                        {messages.filter(m => m.type !== 'system').length > 0 && (
                            <div className="chat-item-badge">{messages.filter(m => m.type !== 'system').length}</div>
                        )}
                    </div>
                </div>
                {onlineUsers.filter(u => u !== username).map((u, i) => (
                    <div key={i} className="chat-item">
                        <div className="chat-item-avatar" style={{ background: getColor(u) }}>{initials(u)}</div>
                        <div className="chat-item-info">
                            <div className="chat-item-name">{u}</div>
                            <div className="chat-item-preview">🟢 Đang hoạt động</div>
                        </div>
                    </div>
                ))}
            </aside>

            {/* Right - Chat Window */}
            <main className="chat-window">
                {selectedChat ? (
                    <>
                        <header className="chat-header">
                            <div className="header-avatar group">👥</div>
                            <div className="header-info">
                                <div className="header-name">{selectedChat}</div>
                                <div className="header-status">
                                    {typingUser && typingUser !== username
                                        ? `${typingUser} đang nhập...`
                                        : `${onlineUsers.length} thành viên online`}
                                </div>
                            </div>
                            <div className="header-actions">
                                <button className="header-btn">🔍</button>
                                <button className="header-btn">📎</button>
                                <button className="header-btn">⋮</button>
                            </div>
                        </header>

                        <div className="messages">
                            {messages.map(msg => {
                                if (msg.type === 'system') return (
                                    <div key={msg.id} className="sys-msg"><span>{msg.text}</span></div>
                                );
                                const isOwn = msg.username === username;
                                return (
                                    <div key={msg.id} className={`msg ${isOwn ? 'own' : 'other'}`}>
                                        {!isOwn && (
                                            <div className="msg-avatar" style={{ background: getColor(msg.username) }}>
                                                {initials(msg.username)}
                                            </div>
                                        )}
                                        <div className="msg-content">
                                            {!isOwn && <div className="msg-name" style={{ color: getColor(msg.username) }}>{msg.username}</div>}
                                            <div className="msg-bubble">
                                                {msg.text}
                                                <span className="msg-time">{fmt(msg.timestamp)} ✓✓</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={endRef} />
                        </div>

                        <form className="input-bar" onSubmit={handleSend}>
                            <button type="button" className="input-btn">😊</button>
                            <button type="button" className="input-btn">📎</button>
                            <input
                                className="input-field"
                                placeholder="Nhập tin nhắn..."
                                value={input}
                                onChange={handleTyping}
                            />
                            <button type="submit" className={`send-btn ${input.trim() ? 'active' : ''}`}>
                                {input.trim() ? '➤' : '🎤'}
                            </button>
                        </form>
                    </>
                ) : (
                    <div className="no-chat">
                        <div>💬</div>
                        <h2>Chọn một cuộc trò chuyện</h2>
                        <p>để bắt đầu nhắn tin</p>
                    </div>
                )}
            </main>
        </div>
    );
}

export default App;
