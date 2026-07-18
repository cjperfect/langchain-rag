"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorCode = void 0;
/**
 * 统一错误码枚举
 *
 * 编码规则：
 *   0        — 成功
 *   4xx      — HTTP 状态码（400-499 客户端错误）
 *   5xx      — HTTP 状态码（500-599 服务端错误）
 *   10xxx    — 认证/授权
 *   20xxx    — 会话
 *   30xxx    — 消息
 *   40xxx    — 附件/文件
 *   50xxx    — Tool / Agent
 *   60xxx    — RAG / 知识库
 */
var ErrorCode;
(function (ErrorCode) {
    // ==========================================================================
    // 通用
    // ==========================================================================
    /** 成功 */
    ErrorCode[ErrorCode["SUCCESS"] = 200] = "SUCCESS";
    // ==========================================================================
    // HTTP 状态码
    // ==========================================================================
    /** 请求参数错误 */
    ErrorCode[ErrorCode["BAD_REQUEST"] = 400] = "BAD_REQUEST";
    /** 未登录 / token 无效 */
    ErrorCode[ErrorCode["UNAUTHORIZED"] = 401] = "UNAUTHORIZED";
    /** 无权限 */
    ErrorCode[ErrorCode["FORBIDDEN"] = 403] = "FORBIDDEN";
    /** 资源不存在 */
    ErrorCode[ErrorCode["NOT_FOUND"] = 404] = "NOT_FOUND";
    /** 资源冲突（如重复注册） */
    ErrorCode[ErrorCode["CONFLICT"] = 409] = "CONFLICT";
    /** 请求过于频繁 */
    ErrorCode[ErrorCode["TOO_MANY_REQUESTS"] = 429] = "TOO_MANY_REQUESTS";
    /** 服务器内部错误 */
    ErrorCode[ErrorCode["INTERNAL_ERROR"] = 500] = "INTERNAL_ERROR";
    // ==========================================================================
    // 认证 / 授权 10xxx
    // ==========================================================================
    /** 邮箱已注册 */
    ErrorCode[ErrorCode["EMAIL_ALREADY_EXISTS"] = 10001] = "EMAIL_ALREADY_EXISTS";
    /** 邮箱或密码错误 */
    ErrorCode[ErrorCode["INVALID_CREDENTIALS"] = 10002] = "INVALID_CREDENTIALS";
    /** Token 已过期 */
    ErrorCode[ErrorCode["TOKEN_EXPIRED"] = 10003] = "TOKEN_EXPIRED";
    /** 用户不存在 */
    ErrorCode[ErrorCode["USER_NOT_FOUND"] = 10004] = "USER_NOT_FOUND";
    /** 密码强度不足 */
    ErrorCode[ErrorCode["WEAK_PASSWORD"] = 10005] = "WEAK_PASSWORD";
    // ==========================================================================
    // 会话 20xxx
    // ==========================================================================
    /** 会话不存在 */
    ErrorCode[ErrorCode["CONVERSATION_NOT_FOUND"] = 20001] = "CONVERSATION_NOT_FOUND";
    /** 无权访问该会话 */
    ErrorCode[ErrorCode["CONVERSATION_ACCESS_DENIED"] = 20002] = "CONVERSATION_ACCESS_DENIED";
    /** 会话已被归档 */
    ErrorCode[ErrorCode["CONVERSATION_ARCHIVED"] = 20003] = "CONVERSATION_ARCHIVED";
    // ==========================================================================
    // 消息 30xxx
    // ==========================================================================
    /** 消息不存在 */
    ErrorCode[ErrorCode["MESSAGE_NOT_FOUND"] = 30001] = "MESSAGE_NOT_FOUND";
    /** 消息不属于该会话 */
    ErrorCode[ErrorCode["MESSAGE_NOT_IN_CONVERSATION"] = 30002] = "MESSAGE_NOT_IN_CONVERSATION";
    /** 消息生成失败 */
    ErrorCode[ErrorCode["MESSAGE_GENERATION_FAILED"] = 30003] = "MESSAGE_GENERATION_FAILED";
    /** 不支持的消息类型 */
    ErrorCode[ErrorCode["UNSUPPORTED_MESSAGE_TYPE"] = 30004] = "UNSUPPORTED_MESSAGE_TYPE";
    // ==========================================================================
    // 附件 / 文件 40xxx
    // ==========================================================================
    /** 文件不存在 */
    ErrorCode[ErrorCode["FILE_NOT_FOUND"] = 40001] = "FILE_NOT_FOUND";
    /** 文件大小超限 */
    ErrorCode[ErrorCode["FILE_TOO_LARGE"] = 40002] = "FILE_TOO_LARGE";
    /** 不支持的文件类型 */
    ErrorCode[ErrorCode["UNSUPPORTED_FILE_TYPE"] = 40003] = "UNSUPPORTED_FILE_TYPE";
    // ==========================================================================
    // Tool / Agent 50xxx
    // ==========================================================================
    /** Tool 执行失败 */
    ErrorCode[ErrorCode["TOOL_EXECUTION_FAILED"] = 50001] = "TOOL_EXECUTION_FAILED";
    /** Tool 执行超时 */
    ErrorCode[ErrorCode["TOOL_EXECUTION_TIMEOUT"] = 50002] = "TOOL_EXECUTION_TIMEOUT";
    /** Agent 执行失败 */
    ErrorCode[ErrorCode["AGENT_EXECUTION_FAILED"] = 50003] = "AGENT_EXECUTION_FAILED";
    // ==========================================================================
    // RAG / 知识库 60xxx
    // ==========================================================================
    /** 文档不存在 */
    ErrorCode[ErrorCode["DOCUMENT_NOT_FOUND"] = 60001] = "DOCUMENT_NOT_FOUND";
    /** 文档解析失败 */
    ErrorCode[ErrorCode["DOCUMENT_PARSE_FAILED"] = 60002] = "DOCUMENT_PARSE_FAILED";
    /** 知识库检索失败 */
    ErrorCode[ErrorCode["RAG_RETRIEVAL_FAILED"] = 60003] = "RAG_RETRIEVAL_FAILED";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
