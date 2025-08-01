import jwt from "jsonwebtoken";

export class AuthService {
  constructor() {
    this.jwt = jwt;
  }

  async signToken(payload, signature, period) {
    const token = await this.jwt.sign({ id: payload }, signature, {
      expiresIn: period,
    });
    return token;
  }

  async verifyToken(token, signature) {
    if (!token) {
      throw new Error("No token provided");
    }
    const verified = await this.jwt.verify(token, signature);
    return verified;
  }
}
