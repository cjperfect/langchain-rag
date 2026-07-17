import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { AuthService } from "./auth.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env["JWT_SECRET"] ?? "dev-secret-change-me",
    });
  }

  /** JWT 验证通过后，将 payload 转为 User 对象注入到 req.user */
  async validate(payload: { sub: number; email: string }) {
    return this.authService.validateUser(payload.sub);
  }
}
