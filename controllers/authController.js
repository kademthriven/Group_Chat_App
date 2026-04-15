const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const { User } = require("../models");
const { normalizeEmail } = require("../utils/personalRoom");
require("dotenv").config();

exports.signup = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        message: "All fields are required"
      });
    }

    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ email }, { phone }]
      }
    });

    if (existingUser) {
      return res.status(409).json({
        message: "User already exists with this email or phone"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      name,
      email,
      phone,
      password: hashedPassword
    });

    return res.status(201).json({
      message: "Signup successful",
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone
      }
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error during signup",
      error: error.message
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        message: "Email/phone and password are required"
      });
    }

    const user = await User.findOne({
      where: {
        [Op.or]: [{ email: identifier }, { phone: identifier }]
      }
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      return res.status(401).json({
        message: "Invalid password"
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        phone: user.phone
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone
      }
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error during login",
      error: error.message
    });
  }
};

exports.findUserByEmail = async (req, res) => {
  try {
    const email = normalizeEmail(req.query.email);

    if (!email) {
      return res.status(400).json({
        message: "Email is required"
      });
    }

    if (email === normalizeEmail(req.user.email)) {
      return res.status(400).json({
        message: "You cannot start a personal chat with your own email"
      });
    }

    const user = await User.findOne({
      where: {
        email
      },
      attributes: ["id", "name", "email"]
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    return res.status(200).json({
      ok: true,
      user
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error while checking email",
      error: error.message
    });
  }
};
