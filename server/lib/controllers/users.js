import { Router } from 'express';
import AdminUser from '../models/AdminUser.js';
import { verifyPassword } from '../utils/password.js';
import { signAdminToken } from '../utils/token.js';

export default Router().post('/sessions', async (req, res, next) => {
  try {
    const { username, password } = req.body ?? {};

    const user =
      typeof username === 'string' && typeof password === 'string'
        ? await AdminUser.findByUsername(username)
        : null;

    // One response for every failure — unknown username, wrong password, or a
    // malformed body. Distinguishing them would let anyone enumerate admin
    // usernames. The frontend maps this 401 to InvalidPasswordError.
    if (!user || !verifyPassword(password, user.passwordHash)) {
      const error = new Error('Invalid username or password');
      error.status = 401;
      throw error;
    }

    res.json({ token: signAdminToken(user) });
  } catch (error) {
    next(error);
  }
});
