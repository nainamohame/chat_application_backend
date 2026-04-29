const asyncHandler = require("../utils/asyncHandler");
const userModel = require("../models/user.model");

const list = asyncHandler(async (req, res) => {
  const users = await userModel.listAllExcept(req.user.id);
  res.json({ success: true, users });
});

module.exports = { list };
