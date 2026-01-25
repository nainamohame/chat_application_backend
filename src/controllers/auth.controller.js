const authService = require('../services/auth.service');

const register = async (req, res, next) => {
     console.log(req.body); 
    try {
        const { name, email, password } = req.body;
        const user = authService.registerUser(name, email, password);

        res.status(201).json({ success: true, user })
    }
    catch (err) {
        next(err)
    }
};

module.exports = {
    register
};