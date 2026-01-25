const bcrypt = require("bcrypt");
const userModel = require("../models/user.model");

const registerUser = async (name, email, password) => {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await userModel.createUser(name, email, hashedPassword);

    return user;
};

module.exports = {
    registerUser
}