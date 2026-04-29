const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const env = require("./config/env");
const messageService = require("./services/message.service");
const messageModel = require("./models/message.model");
const conversationModel = require("./models/conversation.model");

let io = null;

const userRoom = (id) => `user:${id}`;
const conversationRoom = (id) => `conversation:${id}`;

const initSocket = (httpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: env.clientOrigin,
            methods: ["GET", "POST"],
            credentials: true,
        },
    });

    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;
        if (!token) return next(new Error("Missing access token"));
        try {
            const payload = jwt.verify(token, env.jwtAccessSecret);
            socket.userId = payload.sub;
            socket.userEmail = payload.email;
            next();
        } catch {
            next(new Error("Invalid access token"));
        }
    });

    io.on("connection", async (socket) => {
        socket.join(userRoom(socket.userId));

        // Join every conversation the user is a member of.
        try {
            const convIds = await conversationModel.listIdsForUser(socket.userId);
            for (const id of convIds) socket.join(conversationRoom(id));
        } catch (err) {
            console.error("[socket] joining conversation rooms failed:", err.message);
        }

        // Catch-up delivery: bump last_delivered_at on every conversation the user is in,
        // then notify each conversation room so the other members re-render their tick state.
        try {
            const updates = await conversationModel.markAllDeliveredForUser(socket.userId);
            for (const u of updates) {
                io.to(conversationRoom(u.conversation_id)).emit("conversation:delivered", {
                    conversationId: u.conversation_id,
                    userId: socket.userId,
                    last_delivered_at: u.last_delivered_at,
                });
            }
        } catch (err) {
            console.error("[socket] catch-up delivery failed:", err.message);
        }

        socket.on("message:send", async (payload, ack) => {
            try {
                const { conversationId, content, clientId } = payload || {};
                const message = await messageService.sendToConversation(
                    socket.userId,
                    Number(conversationId),
                    content
                );

                // Bump sender's read watermark — they've definitely seen their own message.
                await conversationModel.markRead(message.conversation_id, socket.userId);

                // If any OTHER member is currently connected to this conversation room,
                // bump their last_delivered_at right now.
                const sockets = await io.in(conversationRoom(message.conversation_id)).fetchSockets();
                const onlineOthers = [
                    ...new Set(
                        sockets
                            .map((s) => s.userId)
                            .filter((id) => id != null && id !== socket.userId)
                    ),
                ];
                for (const otherId of onlineOthers) {
                    const wm = await conversationModel.markDelivered(
                        message.conversation_id,
                        otherId
                    );
                    if (wm) {
                        io.to(conversationRoom(message.conversation_id)).emit(
                            "conversation:delivered",
                            {
                                conversationId: message.conversation_id,
                                userId: otherId,
                                last_delivered_at: wm.last_delivered_at,
                            }
                        );
                    }
                }

                // Re-fetch with fresh delivered/read counts after the watermark bumps.
                const enriched = await messageModel.findById(message.id);
                const wire = { ...enriched, clientId };

                io.to(conversationRoom(message.conversation_id)).emit("message:receive", wire);
                socket.emit("message:sent", wire);
                ack && ack({ ok: true, message: wire });
            } catch (err) {
                ack && ack({ ok: false, error: err.message });
            }
        });

        socket.on("message:read", async ({ conversationId }) => {
            try {
                if (!conversationId) return;
                const member = await conversationModel.getMember(conversationId, socket.userId);
                if (!member) return;
                const wm = await conversationModel.markRead(conversationId, socket.userId);
                if (!wm) return;
                io.to(conversationRoom(conversationId)).emit("conversation:read", {
                    conversationId,
                    userId: socket.userId,
                    last_read_at: wm.last_read_at,
                });
            } catch (err) {
                console.error("[socket] message:read failed:", err.message);
            }
        });

        socket.on("typing:start", ({ conversationId }) => {
            if (!conversationId) return;
            socket.to(conversationRoom(conversationId)).emit("typing:start", {
                conversationId,
                userId: socket.userId,
            });
        });

        socket.on("typing:stop", ({ conversationId }) => {
            if (!conversationId) return;
            socket.to(conversationRoom(conversationId)).emit("typing:stop", {
                conversationId,
                userId: socket.userId,
            });
        });

        socket.on("disconnect", () => {});
    });

    return io;
};

const emitToUser = (userId, event, data) => {
    if (!io) return;
    io.to(userRoom(userId)).emit(event, data);
};

const emitToConversation = (conversationId, event, data) => {
    if (!io) return;
    io.to(conversationRoom(conversationId)).emit(event, data);
};

const joinUserToConversation = (userId, conversationId) => {
    if (!io) return;
    const roomName = conversationRoom(conversationId);
    io.in(userRoom(userId)).socketsJoin(roomName);
};

module.exports = { initSocket, emitToUser, emitToConversation, joinUserToConversation };
