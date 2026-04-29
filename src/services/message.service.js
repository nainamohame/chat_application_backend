const HttpError = require("../utils/httpError");
const messageModel = require("../models/message.model");
const conversationModel = require("../models/conversation.model");

const sendToConversation = async (senderId, conversationId, content) => {
    const member = await conversationModel.getMember(conversationId, senderId);
    if (!member) throw new HttpError(403, "Not a member of this conversation");
    return messageModel.insertInto(conversationId, senderId, content);
};

const history = async (userId, conversationId, { limit, before }) => {
    const member = await conversationModel.getMember(conversationId, userId);
    if (!member) throw new HttpError(403, "Not a member of this conversation");
    const messages = await messageModel.listForConversation(conversationId, limit, before);
    const readUpdate = await conversationModel.markRead(conversationId, userId);
    return { messages, readUpdate };
};

module.exports = { sendToConversation, history };
