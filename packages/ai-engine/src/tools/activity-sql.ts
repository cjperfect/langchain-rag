// 获取运营活动的SQL工具
import { tool } from "langchain";
import { z } from "zod";
import {
  buildDeleteAccountSQL,
  buildModifyGameCountSQL,
  buildModifyLotteryAndScoreSQL,
  buildModifyUserPointsSQL,
} from "../libs/generateSQL";

// 定义SQL输入参数，包含手机号和时间
export const sqlInputSchema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, "请输入有效的手机号"),
  launchDate: z.string().describe(`活动上线日期。
支持格式:
- 2026-07-06
- 2026-7-6
- 2026/7/6
- 2026年7月6日
`),
  operationType: z
    .enum(["modify_game_count", "modify_lottery_and_score", "modify_user_points", "delete_account"])
    .describe(
      `
操作类型:
modify_game_count=修改游戏次数
modify_lottery_and_score=修改抽奖次数和活动分数
modify_user_points=修改用户积分
delete_account=删除账号信息
`,
    ),
});

export const activitySqlTool = tool(
  async ({ phone, launchDate, operationType }) => {
    const operationMap = {
      modify_game_count: "修改游戏次数",
      modify_lottery_and_score: "修改抽奖次数和活动分数",
      modify_user_points: "修改用户积分",
      delete_account: "删除账号信息",
    };

    let sql: string;

    switch (operationType) {
      case "modify_game_count":
        sql = buildModifyGameCountSQL(phone, launchDate);
        break;

      case "modify_lottery_and_score":
        sql = buildModifyLotteryAndScoreSQL(phone, launchDate);
        break;

      case "modify_user_points":
        sql = buildModifyUserPointsSQL(phone);
        break;

      case "delete_account":
        sql = buildDeleteAccountSQL(phone);
        break;

      default:
        throw new Error(`不支持的操作类型: ${operationType}`);
    }

    return {
      sql,
      operationName: operationMap[operationType],
    };
  },
  {
    name: "generate_activity_sql",
    description: `根据手机号、活动上线日期和操作类型生成活动相关 SQL。
支持操作:
1. modify_game_count:
   修改游戏次数

2. modify_lottery_and_score:
   修改抽奖次数和活动分数

3. modify_user_points:
   修改用户积分

4. delete_account:
   删除账号信息

注意:
- 只生成 SQL，不执行数据库操作。
- 手机号必须是用户真实手机号。
- 活动日期格式 YYYY-MM-DD。
`,
    schema: sqlInputSchema,
  },
);
