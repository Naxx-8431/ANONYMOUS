'use strict';

module.exports = function requireAuth(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ ok: false, error: 'Not authenticated.' });
    }
    next();
};
