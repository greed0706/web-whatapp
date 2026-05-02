import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const server = createServer(app);

const CORS_ORIGIN = (process.env.CORS_ORIGIN || 'http://localhost:5175')
    .split(',')
    .map((s) => s.trim());

const io = new Server(server, {
    cors: {
        origin: CORS_ORIGIN,
        methods: ['GET', 'POST']
    }
});

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

const users = new Map();

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', variant: 'v2-whatsapp', users: users.size });
});

io.on('connection', (socket) => {
    console.log(`[V2 WhatsApp] User connected: ${socket.id}`);

    socket.on('join', (username) => {
        users.set(socket.id, username);
        io.emit('user_joined', { username, users: Array.from(users.values()) });
    });

    socket.on('send_message', (data) => {
        const username = users.get(socket.id) || 'Anonymous';
        io.emit('new_message', {
            id: Date.now(),
            username,
            text: data.text,
            timestamp: new Date().toISOString()
        });
    });

    socket.on('typing', (isTyping) => {
        const username = users.get(socket.id);
        if (username) socket.broadcast.emit('user_typing', { username, isTyping });
    });

    socket.on('disconnect', () => {
        const username = users.get(socket.id);
        users.delete(socket.id);
        io.emit('user_left', { username, users: Array.from(users.values()) });
    });
});

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
    console.log(`[V2 WhatsApp] Server running on port ${PORT}`);
    console.log(`[V2 WhatsApp] Allowed CORS: ${CORS_ORIGIN.join(', ')}`);
});
