const express = require("express");
const { z } = require("zod");

const authenticate = require("../middleware/authenticate");
const validate = require("../middleware/validate");
const c = require("../controllers/conversation.controller");

const router = express.Router();
router.use(authenticate);

const createGroupSchema = z.object({
    name: z.string().trim().min(1).max(100),
    memberIds: z.array(z.coerce.number().int().positive()).min(1),
});

const renameSchema = z.object({
    name: z.string().trim().min(1).max(100),
});

const addMembersSchema = z.object({
    userIds: z.array(z.coerce.number().int().positive()).min(1),
});

const sendSchema = z.object({
    content: z.string().trim().min(1).max(4000),
});

router.get("/", c.list);
router.post("/", validate(createGroupSchema), c.createGroup);
router.post("/dm/:userId", c.getOrCreateDm);
router.get("/:id", c.getDetails);
router.patch("/:id", validate(renameSchema), c.rename);
router.post("/:id/members", validate(addMembersSchema), c.addMembers);
router.delete("/:id/members/:userId", c.removeMember);
router.get("/:id/messages", c.history);
router.post("/:id/messages", validate(sendSchema), c.send);

module.exports = router;
