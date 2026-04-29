const express = require("express");
const authenticate = require("../middleware/authenticate");
const userController = require("../controllers/user.controller");

const router = express.Router();

router.get("/", authenticate, userController.list);

module.exports = router;
