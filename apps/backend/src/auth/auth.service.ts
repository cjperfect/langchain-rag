import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { Exceptions } from "../common/exceptions/business.exception";
import { ErrorCode } from "@langchain-rag/shared";
import * as bcrypt from "bcryptjs";
import type { RegisterDto, LoginDto } from "./dto/auth.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /** 注册 */
  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw Exceptions.conflict(ErrorCode.EMAIL_ALREADY_EXISTS, "邮箱已注册");
    }

    const hashed = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashed,
      },
    });

    return this.signToken(user.id, user.email);
  }

  /** 登录 */
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw Exceptions.unauthorized(ErrorCode.INVALID_CREDENTIALS, "邮箱或密码错误");
    }

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) {
      throw Exceptions.unauthorized(ErrorCode.INVALID_CREDENTIALS, "邮箱或密码错误");
    }

    return this.signToken(user.id, user.email);
  }

  /** 根据 userId 查询用户（供 JWT strategy 使用） */
  async validateUser(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });
    if (!user) {
      throw Exceptions.unauthorized(ErrorCode.USER_NOT_FOUND, "用户不存在");
    }
    return user;
  }

  /** 签发 JWT */
  private signToken(userId: number, email: string) {
    const payload = { sub: userId, email };
    return {
      access_token: this.jwtService.sign(payload),
      user: { id: userId, email },
    };
  }
}
