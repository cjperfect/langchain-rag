"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  AiEngine: () => AiEngine
});
module.exports = __toCommonJS(index_exports);
var import_config = require("dotenv/config");

// src/agent/index.ts
var import_messages = require("@langchain/core/messages");
var import_langchain2 = require("langchain");
var import_openai2 = require("@langchain/openai");

// src/agent/model.ts
var import_openai = require("@langchain/openai");
var model = new import_openai.ChatOpenAI({
  model: "deepseek-v4-flash",
  apiKey: process.env.DEEPSEEK_API_KEY,
  temperature: 0.7,
  maxTokens: 1024,
  timeout: 6e4,
  configuration: {
    baseURL: "https://api.deepseek.com"
  }
});

// src/prompts/system.ts
var systemPrompt = `\u4F60\u662F\u4E00\u4E2A\u4E13\u4E1A\u7684\u4F01\u4E1A\u5185\u90E8\u667A\u80FD\u52A9\u624B\uFF0C\u670D\u52A1\u4E8E\u516C\u53F8\u7684\u8FD0\u8425\u3001\u4EA7\u54C1\u548C\u6570\u636E\u56E2\u961F\u3002
## \u4F60\u7684\u6838\u5FC3\u80FD\u529B
1. **SQL \u67E5\u8BE2\u751F\u6210**\uFF1A\u6839\u636E\u7528\u6237\u7684\u4E1A\u52A1\u9700\u6C42\uFF0C\u751F\u6210\u7B26\u5408\u516C\u53F8\u6570\u636E\u89C4\u8303\u7684 SQL \u67E5\u8BE2\u8BED\u53E5\u3002
2. **\u4F01\u4E1A\u5185\u90E8\u8D44\u6599\u67E5\u8BE2**\uFF1A\u57FA\u4E8E\u63D0\u4F9B\u7684\u77E5\u8BC6\u5E93\u6587\u6863\uFF0C\u56DE\u7B54\u5173\u4E8E\u516C\u53F8\u653F\u7B56\u3001\u6D41\u7A0B\u3001\u4EA7\u54C1\u89C4\u8303\u7B49\u95EE\u9898\u3002

## \u6838\u5FC3\u884C\u4E3A\u51C6\u5219
### \u5BF9\u4E8E SQL \u751F\u6210\u4EFB\u52A1\uFF1A
- **\u4E25\u683C\u9075\u5FAA\u89C4\u8303**\uFF1A\u751F\u6210\u7684 SQL \u5FC5\u987B\u7B26\u5408\u516C\u53F8\u6570\u636E\u4ED3\u5E93\u7684\u547D\u540D\u89C4\u8303\uFF08\u5982\u5B57\u6BB5\u540D\u3001\u8868\u540D\uFF09\u3002
- **\u5B89\u5168\u7B2C\u4E00**\uFF1A\u751F\u6210\u7684 SQL \u5E94\u907F\u514D\u5168\u8868\u626B\u63CF\uFF0C\u5BF9\u4E8E UPDATE/DELETE \u64CD\u4F5C\u5FC5\u987B\u9644\u5E26\u660E\u786E\u7684 WHERE \u6761\u4EF6\u3002
- **\u89E3\u91CA\u6E05\u6670**\uFF1A\u5728\u63D0\u4F9B SQL \u7684\u540C\u65F6\uFF0C\u5FC5\u987B\u7528\u901A\u4FD7\u7684\u8BED\u8A00\u89E3\u91CA\u67E5\u8BE2\u903B\u8F91\uFF0C\u5E2E\u52A9\u8FD0\u8425\u540C\u4E8B\u7406\u89E3\u3002
- **\u5148\u786E\u8BA4\u518D\u6267\u884C**\uFF1A\u5BF9\u4E8E\u590D\u6742\u7684\u67E5\u8BE2\u6216\u6570\u636E\u64CD\u4F5C\uFF0C\u5EFA\u8BAE\u7528\u6237\u5148\u5728\u6D4B\u8BD5\u73AF\u5883\u9A8C\u8BC1\u3002

### \u5BF9\u4E8E\u8D44\u6599\u67E5\u8BE2\u4EFB\u52A1\uFF08RAG\uFF09\uFF1A
- **\u57FA\u4E8E\u63D0\u4F9B\u7684\u5185\u5BB9\u56DE\u7B54**\uFF1A\u4F60\u7684\u56DE\u7B54\u5FC5\u987B\u4E25\u683C\u57FA\u4E8E\u68C0\u7D22\u5230\u7684\u77E5\u8BC6\u5E93\u7247\u6BB5\uFF08\u5728 <documents> \u6807\u7B7E\u4E2D\u63D0\u4F9B\uFF09\u3002
- **\u5F15\u7528\u6765\u6E90**\uFF1A\u56DE\u7B54\u65F6\u5E94\u5F15\u7528\u5BF9\u5E94\u7684\u6587\u6863\u6765\u6E90\uFF0C\u4F8B\u5982\u201C\u6839\u636E\u300A\u7528\u6237\u589E\u957F\u89C4\u8303 V2.1\u300B\u7B2C3.2\u8282...\u201D\u3002
- **\u65E0\u6CD5\u56DE\u7B54\u65F6**\uFF1A\u5982\u679C\u68C0\u7D22\u5230\u7684\u6587\u6863\u4E2D\u6CA1\u6709\u76F8\u5173\u4FE1\u606F\uFF0C\u8BF7\u660E\u786E\u544A\u77E5\u7528\u6237\uFF0C\u5E76\u5EFA\u8BAE\u4ED6\u4EEC\u8054\u7CFB\u76F8\u5173\u56E2\u961F\u6216\u641C\u7D22\u66F4\u7CBE\u786E\u7684\u5173\u952E\u8BCD\uFF0C**\u4E25\u7981\u7F16\u9020\u4FE1\u606F**\u3002

## \u8F93\u51FA\u683C\u5F0F\u89C4\u8303
- **SQL \u67E5\u8BE2**\uFF1A\u4F7F\u7528 markdown \u7684 \`\`\`sql \u4EE3\u7801\u5757\u5305\u88F9\u3002
- **\u8D44\u6599\u67E5\u8BE2**\uFF1A\u7ED3\u6784\u5316\u8F93\u51FA\uFF0C\u4F7F\u7528\u6807\u9898\u3001\u5217\u8868\u7B49\u683C\u5F0F\u63D0\u9AD8\u53EF\u8BFB\u6027\u3002
- **\u590D\u5408\u95EE\u9898**\uFF1A\u5982\u679C\u7528\u6237\u7684\u95EE\u9898\u540C\u65F6\u6D89\u53CA SQL \u548C\u8D44\u6599\u67E5\u8BE2\uFF0C\u8BF7\u5148\u5904\u7406\u8D44\u6599\u67E5\u8BE2\uFF0C\u518D\u751F\u6210 SQL\u3002
`;

// src/tools/activity-sql.ts
var import_langchain = require("langchain");
var import_zod = require("zod");

// src/libs/generateSQL.ts
function normalizeDate(dateInput) {
  const input = dateInput.trim();
  let year;
  let month;
  let day;
  const chineseMatch = input.match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日?/);
  if (chineseMatch) {
    [, year, month, day] = chineseMatch;
  } else {
    const normalMatch = input.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (!normalMatch) {
      throw new Error(`\u65E0\u6CD5\u8BC6\u522B\u65E5\u671F\u683C\u5F0F: ${dateInput}`);
    }
    [, year, month, day] = normalMatch;
  }
  const monthNum = Number(month);
  const dayNum = Number(day);
  if (monthNum < 1 || monthNum > 12) {
    throw new Error(`\u6708\u4EFD\u975E\u6CD5: ${month}`);
  }
  if (dayNum < 1 || dayNum > 31) {
    throw new Error(`\u65E5\u671F\u975E\u6CD5: ${day}`);
  }
  return [year, month.padStart(2, "0"), day.padStart(2, "0")].join("");
}
function generateCodes(launchDate) {
  const dateStr = normalizeDate(launchDate);
  return {
    activityCode: `A${dateStr}`,
    gameCode: `G${dateStr}`,
    vCode: `V${dateStr}`
  };
}
function buildModifyGameCountSQL(phone, launchDate) {
  const { activityCode, gameCode } = generateCodes(launchDate);
  return `-- ===========\u4FEE\u6539\u6E38\u620F\u6B21\u6570=============
-- \u6D3B\u52A8\u7F16\u7801
set @activity_code = '${activityCode}';

-- \u6E38\u620F\u7F16\u7801
set @game_code = '${gameCode}';

set @phone = '${phone}';

set @uid = (select uid from breo_activity.ac_user_join where phone = @phone and activity_code = @activity_code);

-- \u4FEE\u6539\u6E38\u620F\u6B21\u6570
update breo_activity.ac_game_user_count_info
set user_count = 99
where uid = @uid and game_code = @game_code;`;
}
function buildModifyLotteryAndScoreSQL(phone, launchDate) {
  const { activityCode, gameCode } = generateCodes(launchDate);
  return `-- ===========\u4FEE\u6539\u62BD\u5956\u6B21\u6570\u548C\u6D3B\u52A8\u5206\u6570=============
-- \u6D3B\u52A8\u7F16\u7801
set @activity_code = '${activityCode}';

-- \u6E38\u620F\u7F16\u7801
set @game_code = '${gameCode}';

set @phone = '${phone}';

set @uid = (select uid from breo_activity.ac_user_join where phone = @phone and activity_code = @activity_code);

-- \u4FEE\u6539\u62BD\u5956\u6B21\u6570\u548C\u6D3B\u52A8\u5206\u6570
update breo_activity.ac_user_join
set lottery_count = 99, score = 9999
where activity_code = @activity_code and uid = @uid;`;
}
function buildModifyUserPointsSQL(phone) {
  return `-- ============\u4FEE\u6539\u7528\u6237\u79EF\u5206==============
set @phone = '${phone}';

set @uid = (select USER_UNION_ID from breo_user_center.t_breo_user_standard_info where PHONE_NUMBER = @phone);

update breo_user_center.t_user_level_info
set point = 9999
where uid = @uid and is_deleted = 0;`;
}
function buildDeleteAccountSQL(phone) {
  return `-- =============\u5220\u9664\u8D26\u53F7\u4FE1\u606F==============
set @phone = '${phone}';

set @uid = (select USER_UNION_ID from breo_user_center.t_breo_user_standard_info where PHONE_NUMBER = @phone);

delete from breo_user_center.us_third_bind_info where uid = (select USER_UNION_ID  from breo_user_center.t_breo_user_standard_info   tbcusi where PHONE_NUMBER  = @phone);
delete from breo_user_center.t_user_level_info  where uid = (select USER_UNION_ID  from breo_user_center.t_breo_user_standard_info   where PHONE_NUMBER  = @phone);
delete from breo_user_center.t_breo_user_standard_info  where PHONE_NUMBER  = @phone;
delete from new_breo_app.breo_customer_info where telephone = @phone;`;
}

// src/tools/activity-sql.ts
var sqlInputSchema = import_zod.z.object({
  phone: import_zod.z.string().regex(/^1[3-9]\d{9}$/, "\u8BF7\u8F93\u5165\u6709\u6548\u7684\u624B\u673A\u53F7"),
  launchDate: import_zod.z.string().describe(`\u6D3B\u52A8\u4E0A\u7EBF\u65E5\u671F\u3002
\u652F\u6301\u683C\u5F0F:
- 2026-07-06
- 2026-7-6
- 2026/7/6
- 2026\u5E747\u67086\u65E5
`),
  operationType: import_zod.z.enum(["modify_game_count", "modify_lottery_and_score", "modify_user_points", "delete_account"]).describe(
    `
\u64CD\u4F5C\u7C7B\u578B:
modify_game_count=\u4FEE\u6539\u6E38\u620F\u6B21\u6570
modify_lottery_and_score=\u4FEE\u6539\u62BD\u5956\u6B21\u6570\u548C\u6D3B\u52A8\u5206\u6570
modify_user_points=\u4FEE\u6539\u7528\u6237\u79EF\u5206
delete_account=\u5220\u9664\u8D26\u53F7\u4FE1\u606F
`
  )
});
var activitySqlTool = (0, import_langchain.tool)(
  async ({ phone, launchDate, operationType }) => {
    const operationMap = {
      modify_game_count: "\u4FEE\u6539\u6E38\u620F\u6B21\u6570",
      modify_lottery_and_score: "\u4FEE\u6539\u62BD\u5956\u6B21\u6570\u548C\u6D3B\u52A8\u5206\u6570",
      modify_user_points: "\u4FEE\u6539\u7528\u6237\u79EF\u5206",
      delete_account: "\u5220\u9664\u8D26\u53F7\u4FE1\u606F"
    };
    let sql;
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
        throw new Error(`\u4E0D\u652F\u6301\u7684\u64CD\u4F5C\u7C7B\u578B: ${operationType}`);
    }
    return {
      sql,
      operationName: operationMap[operationType]
    };
  },
  {
    name: "generate_activity_sql",
    description: `\u6839\u636E\u624B\u673A\u53F7\u3001\u6D3B\u52A8\u4E0A\u7EBF\u65E5\u671F\u548C\u64CD\u4F5C\u7C7B\u578B\u751F\u6210\u6D3B\u52A8\u76F8\u5173 SQL\u3002
\u652F\u6301\u64CD\u4F5C:
1. modify_game_count:
   \u4FEE\u6539\u6E38\u620F\u6B21\u6570

2. modify_lottery_and_score:
   \u4FEE\u6539\u62BD\u5956\u6B21\u6570\u548C\u6D3B\u52A8\u5206\u6570

3. modify_user_points:
   \u4FEE\u6539\u7528\u6237\u79EF\u5206

4. delete_account:
   \u5220\u9664\u8D26\u53F7\u4FE1\u606F

\u6CE8\u610F:
- \u53EA\u751F\u6210 SQL\uFF0C\u4E0D\u6267\u884C\u6570\u636E\u5E93\u64CD\u4F5C\u3002
- \u624B\u673A\u53F7\u5FC5\u987B\u662F\u7528\u6237\u771F\u5B9E\u624B\u673A\u53F7\u3002
- \u6D3B\u52A8\u65E5\u671F\u683C\u5F0F YYYY-MM-DD\u3002
`,
    schema: sqlInputSchema
  }
);

// src/agent/index.ts
function toLangChainMessages(messages) {
  return messages.map((m) => {
    switch (m.role) {
      case "user":
        return new import_messages.HumanMessage(m.content);
      case "assistant":
        return new import_messages.AIMessage(m.content);
      case "system":
        return new import_messages.SystemMessage(m.content);
    }
  });
}
function createModel(modelName) {
  if (!modelName || modelName === model.model) return model;
  return new import_openai2.ChatOpenAI({
    model: modelName,
    apiKey: process.env.DEEPSEEK_API_KEY,
    temperature: 0.7,
    maxTokens: 1024,
    timeout: 6e4,
    configuration: { baseURL: "https://api.deepseek.com" }
  });
}
var AiEngine = class _AiEngine {
  /**
   * Agent 全局单例
   */
  static agent = (0, import_langchain2.createAgent)({
    model,
    tools: [activitySqlTool],
    systemPrompt
  });
  /** 获取 agent（需要切换模型时创建新实例） */
  getAgent(modelName) {
    if (!modelName || modelName === model.model) return _AiEngine.agent;
    return (0, import_langchain2.createAgent)({
      model: createModel(modelName),
      tools: [activitySqlTool],
      systemPrompt
    });
  }
  /**
   * 普通对话
   */
  async chat(input, options = {}) {
    const messages = [...toLangChainMessages(options.history ?? []), new import_messages.HumanMessage(input)];
    const res = await this.getAgent(options.model).invoke({ messages });
    const last = res.messages.at(-1);
    return typeof last?.content === "string" ? last.content : JSON.stringify(last?.content);
  }
  /**
   * LangChain Stream
   */
  async *stream(input, options = {}) {
    const messages = [...toLangChainMessages(options.history ?? []), new import_messages.HumanMessage(input)];
    const stream = await this.getAgent(options.model).stream(
      { messages },
      { streamMode: "messages" }
    );
    for await (const [chunk] of stream) {
      if (typeof chunk.content === "string") {
        yield chunk.content;
      }
    }
  }
  /**
   * Stream Events
   */
  async *streamEvents(input, options = {}) {
    const messages = [...toLangChainMessages(options.history ?? []), new import_messages.HumanMessage(input)];
    const stream = await this.getAgent(options.model).streamEvents({ messages }, { version: "v2" });
    for await (const event of stream) {
      switch (event.event) {
        case "on_chat_model_stream": {
          const chunk = event.data.chunk;
          const reasoning = chunk.additional_kwargs?.reasoning_content;
          if (typeof reasoning === "string" && reasoning) {
            yield { type: "reasoning", content: reasoning };
          }
          if (typeof chunk.content === "string" && chunk.content) {
            yield { type: "token", content: chunk.content };
          }
          break;
        }
        case "on_tool_start":
          yield { type: "tool_start", name: event.name };
          break;
        case "on_tool_end":
          yield {
            type: "tool_end",
            name: event.name,
            result: event.data.output
          };
          break;
      }
    }
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AiEngine
});
