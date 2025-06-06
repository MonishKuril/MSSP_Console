
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
require('dotenv').config();

router.post('/login', (req, res) => {
  const { username, password, role } = req.body;

  let validCredentials = false;

  if (role === 'superadmin') {
    validCredentials = username === process.env.SUPERADMIN_USERNAME && password === process.env.SUPERADMIN_PASSWORD;
  } else if (role === 'admin') {
    // Check for default admin
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
      validCredentials = true;
    } else {
      // Check for dynamically created admins
      const adminUsername = process.env[`ADMIN_USERNAME_${username}`];
      const adminPassword = process.env[`ADMIN_PASSWORD_${username}`];
      validCredentials = username === adminUsername && password === adminPassword;
    }
  }

  if (validCredentials) {
    const token = jwt.sign(
      { username, role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000
    });

    res.json({ success: true, message: "Login successful" });
  } else {
    res.status(401).json({ success: false, message: "Invalid credentials" });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true, message: "Logout successful" });
});

router.get('/check', (req, res) => {
  const token = req.cookies.token;
  if (!token) {
    return res.json({ authenticated: false });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ authenticated: true, role: decoded.role, username: decoded.username });
  } catch (error) {
    res.clearCookie('token');
    res.json({ authenticated: false });
  }
});

module.exports = router;