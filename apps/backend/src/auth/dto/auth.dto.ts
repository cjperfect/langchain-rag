export interface RegisterDto {
  /** 用户名 */
  name: string;
  /** 邮箱 */
  email: string;
  /** 密码 */
  password: string;
}

export interface LoginDto {
  /** 邮箱 */
  email: string;
  /** 密码 */
  password: string;
}
