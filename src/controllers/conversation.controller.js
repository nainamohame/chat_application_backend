const asyncHandler = require("../utils/asyncHandler");
const conversationService = require("../services/conversation.service");
const messageService = require("../services/message.service");
const conversationModel = require("../models/conversation.model");
const { emitToConversation, emitToUser, joinUserToConversation } = require("../socket");

const list = asyncHandler(async (req, res) => {
    const conversations = await conversationService.listForUser(req.user.id);
    res.json({ success: true, conversations });
});

const createGroup = asyncHandler(async (req, res) => {
    const conv = await conversationService.createGroup(req.user.id, req.body);
    // Tell every member's user-room about the new conversation, and make sure
    // their open sockets join the new conversation room immediately.
    for (const m of conv.members) {
        joinUserToConversation(m.user_id, conv.id);
        emitToUser(m.user_id, "conversation:created", conv);
    }
    res.status(201).json({ success: true, conversation: conv });
});

const getOrCreateDm = asyncHandler(async (req, res) => {
    const otherId = parseInt(req.params.userId, 10);
    const conv = await conversationService.getOrCreateDm(req.user.id, otherId);
    // Both DM members need their sockets in the conversation room (no-op if already created).
    for (const m of conv.members) {
        joinUserToConversation(m.user_id, conv.id);
    }
    res.json({ success: true, conversation: conv });
});

const getDetails = asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const conv = await conversationService.getDetails(id, req.user.id);
    res.json({ success: true, conversation: conv });
});

const rename = asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const updated = await conversationService.renameGroup(id, req.user.id, req.body.name);
    emitToConversation(id, "conversation:updated", { id, name: updated.name });
    res.json({ success: true, conversation: updated });
});

const addMembers = asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const added = await conversationService.addGroupMembers(id, req.user.id, req.body.userIds);
    if (added.length) {
        const detail = await conversationService.getDetails(id, req.user.id);
        for (const userId of added) {
            joinUserToConversation(userId, id);
            emitToUser(userId, "conversation:created", detail);
        }
        emitToConversation(id, "conversation:updated", {
            id,
            members: detail.members,
        });
    }
    res.json({ success: true, addedUserIds: added });
});

const removeMember = asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const targetUserId = parseInt(req.params.userId, 10);
    const ok = await conversationService.removeGroupMember(id, req.user.id, targetUserId);
    if (ok) {
        emitToUser(targetUserId, "conversation:removed", { id });
        const detail = await conversationModel.findById(id);
        const members = await conversationModel.listMembers(id);
        emitToConversation(id, "conversation:updated", {
            id,
            members,
            updated_at: detail.updated_at,
        });
    }
    res.json({ success: true, removed: ok });
});

const history = asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const before = req.query.before || null;
    const { messages, readUpdate } = await messageService.history(req.user.id, id, {
        limit,
        before,
    });
    if (readUpdate) {
        emitToConversation(id, "conversation:read", {
            conversationId: id,
            userId: req.user.id,
            last_read_at: readUpdate.last_read_at,
        });
    }
    res.json({ success: true, messages });
});

const send = asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const message = await messageService.sendToConversation(req.user.id, id, req.body.content);
    emitToConversation(id, "message:receive", message);
    res.status(201).json({ success: true, message });
});

module.exports = {
    list,
    createGroup,
    getOrCreateDm,
    getDetails,
    rename,
    addMembers,
    removeMember,
    history,
    send,
};
