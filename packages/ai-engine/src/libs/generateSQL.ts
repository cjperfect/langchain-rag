function normalizeDate(dateInput: string): string {
  const input = dateInput.trim();

  let year: string;
  let month: string;
  let day: string;

  // 中文格式：2028年5月6日
  const chineseMatch = input.match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日?/);

  if (chineseMatch) {
    [, year, month, day] = chineseMatch;
  } else {
    // 通用格式：
    // 2026-1-2
    // 2026/01/02
    // 2026.1.2
    const normalMatch = input.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);

    if (!normalMatch) {
      throw new Error(`无法识别日期格式: ${dateInput}`);
    }

    [, year, month, day] = normalMatch;
  }

  const monthNum = Number(month);
  const dayNum = Number(day);

  // 基础校验
  if (monthNum < 1 || monthNum > 12) {
    throw new Error(`月份非法: ${month}`);
  }

  if (dayNum < 1 || dayNum > 31) {
    throw new Error(`日期非法: ${day}`);
  }

  return [year, month.padStart(2, "0"), day.padStart(2, "0")].join("");
}

/**
 * 根据活动上线日期生成三个活动编码：
 * - activity_code: A + YYYYMMDD
 * - game_code:     G + YYYYMMDD
 * - V-code:        V + YYYYMMDD
 */
function generateCodes(launchDate: string) {
  const dateStr = normalizeDate(launchDate);
  return {
    activityCode: `A${dateStr}`,
    gameCode: `G${dateStr}`,
    vCode: `V${dateStr}`,
  };
}

export function buildModifyGameCountSQL(phone: string, launchDate: string) {
  const { activityCode, gameCode } = generateCodes(launchDate);
  return `-- ===========修改游戏次数=============
-- 活动编码
set @activity_code = '${activityCode}';

-- 游戏编码
set @game_code = '${gameCode}';

set @phone = '${phone}';

set @uid = (select uid from breo_activity.ac_user_join where phone = @phone and activity_code = @activity_code);

-- 修改游戏次数
update breo_activity.ac_game_user_count_info
set user_count = 99
where uid = @uid and game_code = @game_code;`;
}

export function buildModifyLotteryAndScoreSQL(phone: string, launchDate: string) {
  const { activityCode, gameCode } = generateCodes(launchDate);
  return `-- ===========修改抽奖次数和活动分数=============
-- 活动编码
set @activity_code = '${activityCode}';

-- 游戏编码
set @game_code = '${gameCode}';

set @phone = '${phone}';

set @uid = (select uid from breo_activity.ac_user_join where phone = @phone and activity_code = @activity_code);

-- 修改抽奖次数和活动分数
update breo_activity.ac_user_join
set lottery_count = 99, score = 9999
where activity_code = @activity_code and uid = @uid;`;
}

export function buildModifyUserPointsSQL(phone: string) {
  return `-- ============修改用户积分==============
set @phone = '${phone}';

set @uid = (select USER_UNION_ID from breo_user_center.t_breo_user_standard_info where PHONE_NUMBER = @phone);

update breo_user_center.t_user_level_info
set point = 9999
where uid = @uid and is_deleted = 0;`;
}

export function buildDeleteAccountSQL(phone: string) {
  return `-- =============删除账号信息==============
set @phone = '${phone}';

set @uid = (select USER_UNION_ID from breo_user_center.t_breo_user_standard_info where PHONE_NUMBER = @phone);

delete from breo_user_center.us_third_bind_info where uid = (select USER_UNION_ID  from breo_user_center.t_breo_user_standard_info   tbcusi where PHONE_NUMBER  = @phone);
delete from breo_user_center.t_user_level_info  where uid = (select USER_UNION_ID  from breo_user_center.t_breo_user_standard_info   where PHONE_NUMBER  = @phone);
delete from breo_user_center.t_breo_user_standard_info  where PHONE_NUMBER  = @phone;
delete from new_breo_app.breo_customer_info where telephone = @phone;`;
}
