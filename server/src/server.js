import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const server = createServer(app);

const io = new Server(server, {
    cors: {
        origin: 'http://localhost:5175',
        methods: ['GET', 'POST']
    }
});

app.use(cors());
app.use(express.json());

const users = new Map();

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

server.listen(3002, () => console.log('🌿 [V2 WhatsApp] Server: http://localhost:3002'));
