import { Controller, Post, Body } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { RegisterDto, LoginDto } from "./dto/auth.dto";

@Controller("api/auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** 注册 */
  @Post("register")
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /** 登录 */
  @Post("login")
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
