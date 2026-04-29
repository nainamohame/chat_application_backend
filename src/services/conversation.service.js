const HttpError = require("../utils/httpError");
const conversationModel = require("../models/conversation.model");
const userModel = require("../models/user.model");

const ensureMember = async (conversationId, userId) => {
    const member = await conversationModel.getMember(conversationId, userId);
    if (!member) throw new HttpError(403, "Not a member of this conversation");
    return member;
};

const ensureAdmin = async (conversationId, userId) => {
    const member = await ensureMember(conversationId, userId);
    if (member.role !== "admin") throw new HttpError(403, "Admin permission required");
    return member;
};

const listForUser = (userId) => conversationModel.listForUser(userId);

const getOrCreateDm = async (selfId, otherId) => {
    if (Number(otherId) === Number(selfId)) {
        throw new HttpError(400, "Cannot DM yourself");
    }
    const other = await userModel.findById(otherId);
    if (!other) throw new HttpError(404, "User not found");

    const existingId = await conversationModel.findDmBetween(selfId, otherId);
    if (existingId) {
        return getDetails(existingId, selfId);
    }
    const conv = await conversationModel.create({
        type: "dm",
        name: null,
        createdBy: selfId,
    });
    await conversationModel.addMembers(conv.id, [selfId, otherId]);
    return getDetails(conv.id, selfId);
};

const createGroup = async (selfId, { name, memberIds }) => {
    const trimmed = (name || "").trim();
    if (!trimmed) throw new HttpError(400, "Group name is required");
    const ids = [...new Set([selfId, ...memberIds.map(Number)])].filter((n) => Number.isInteger(n));
    if (ids.length < 2) throw new HttpError(400, "A group needs at least one other member");

    // Validate every other member exists.
    for (const id of ids) {
        if (id === selfId) continue;
        const u = await userModel.findById(id);
        if (!u) throw new HttpError(404, `User ${id} not found`);
    }

    const conv = await conversationModel.create({
        type: "group",
        name: trimmed,
        createdBy: selfId,
    });
    await conversationModel.addMembers(conv.id, [selfId], "admin");
    const others = ids.filter((id) => id !== selfId);
    if (others.length) await conversationModel.addMembers(conv.id, others, "member");
    return getDetails(conv.id, selfId);
};

const getDetails = async (conversationId, requesterId) => {
    await ensureMember(conversationId, requesterId);
    const conv = await conversationModel.findById(conversationId);
    if (!conv) throw new HttpError(404, "Conversation not found");
    const members = await conversationModel.listMembers(conversationId);
    return { ...conv, members };
};

const renameGroup = async (conversationId, userId, name) => {
    const conv = await conversationModel.findById(conversationId);
    if (!conv) throw new HttpError(404, "Conversation not found");
    if (conv.type !== "group") throw new HttpError(400, "Only groups can be renamed");
    await ensureAdmin(conversationId, userId);
    const trimmed = (name || "").trim();
    if (!trimmed) throw new HttpError(400, "Name cannot be empty");
    const updated = await conversationModel.renameGroup(conversationId, trimmed);
    return updated;
};

const addGroupMembers = async (conversationId, requesterId, userIds) => {
    const conv = await conversationModel.findById(conversationId);
    if (!conv) throw new HttpError(404, "Conversation not found");
    if (conv.type !== "group") throw new HttpError(400, "Only groups support adding members");
    await ensureAdmin(conversationId, requesterId);
    for (const id of userIds) {
        const u = await userModel.findById(id);
        if (!u) throw new HttpError(404, `User ${id} not found`);
    }
    const added = await conversationModel.addMembers(conversationId, userIds, "member");
    if (added.length) await conversationModel.touchUpdated(conversationId);
    return added;
};

const removeGroupMember = async (conversationId, requesterId, targetUserId) => {
    const conv = await conversationModel.findById(conversationId);
    if (!conv) throw new HttpError(404, "Conversation not found");
    if (conv.type !== "group") throw new HttpError(400, "Only groups support removing members");
    if (Number(requesterId) !== Number(targetUserId)) {
        await ensureAdmin(conversationId, requesterId);
    } else {
        await ensureMember(conversationId, requesterId);
    }
    const ok = await conversationModel.removeMember(conversationId, targetUserId);
    if (ok) await conversationModel.touchUpdated(conversationId);
    return ok;
};

module.exports = {
    listForUser,
    getOrCreateDm,
    createGroup,
    getDetails,
    renameGroup,
    addGroupMembers,
    removeGroupMember,
    ensureMember,
};
