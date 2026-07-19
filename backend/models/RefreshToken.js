const mongoose = require('mongoose');
const crypto = require('crypto');

const RefreshTokenSchema = new mongoose.Schema(
  {
    jti: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // sha256(token) — for fast lookup without storing the plaintext token.
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    // Short device fingerprint ("Chrome on macOS", etc.) — purely advisory.
    userAgent: { type: String, default: '' },
    ip: { type: String, default: '' },
    issuedAt: { type: Date, default: Date.now },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // Mongo TTL
    },
    revokedAt: { type: Date, default: null },
    revokedReason: {
      type: String,
      enum: ['logout', 'rotation', 'password_change', 'admin', 'reuse_detected', null],
      default: null,
    },
    // Set when this token is replaced by a refresh; for reuse detection.
    replacedBy: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

RefreshTokenSchema.statics.hashToken = function (token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
};

RefreshTokenSchema.statics.issue = function ({ user, userAgent, ip, ttlSeconds }) {
  const jti = crypto.randomBytes(16).toString('hex');
  const token = crypto.randomBytes(48).toString('base64url');
  const tokenHash = this.hashToken(token);
  const doc = new this({
    jti,
    user: user._id,
    tokenHash,
    userAgent: String(userAgent || '').slice(0, 256),
    ip: String(ip || '').slice(0, 64),
    expiresAt: new Date(Date.now() + ttlSeconds * 1000),
  });
  return { doc, token, jti };
};

RefreshTokenSchema.statics.rotate = async function ({ presentedToken, userAgent, ip, ttlSeconds }) {
  const presentedHash = this.hashToken(presentedToken);
  const existing = await this.findOne({ tokenHash: presentedHash });
  if (!existing) return { error: 'unknown_token' };

  if (existing.revokedAt) {
    // Reuse of a revoked token => revoke the entire family and force re-auth.
    await this.updateMany(
      { user: existing.user, revokedAt: null },
      { revokedAt: new Date(), revokedReason: 'reuse_detected' }
    );
    return { error: 'reuse_detected' };
  }
  if (existing.expiresAt.getTime() < Date.now()) {
    return { error: 'expired' };
  }

  const issued = await this.constructor.issue({ user: existing.user, userAgent, ip, ttlSeconds });
  await issued.doc.save();

  existing.revokedAt = new Date();
  existing.revokedReason = 'rotation';
  existing.replacedBy = issued.jti;
  await existing.save();

  return { token: issued.token, jti: issued.jti, doc: issued.doc };
};

RefreshTokenSchema.statics.revoke = async function (token, reason = 'logout') {
  if (!token) return;
  const hash = this.hashToken(token);
  await this.updateOne(
    { tokenHash: hash, revokedAt: null },
    { revokedAt: new Date(), revokedReason: reason }
  );
};

RefreshTokenSchema.statics.revokeAllForUser = async function (userId, reason = 'admin') {
  await this.updateMany(
    { user: userId, revokedAt: null },
    { revokedAt: new Date(), revokedReason: reason }
  );
};

module.exports = mongoose.model('RefreshToken', RefreshTokenSchema);
