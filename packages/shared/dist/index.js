// src/enums/status.ts
var CommonStatus = /* @__PURE__ */ ((CommonStatus2) => {
  CommonStatus2[CommonStatus2["NORMAL"] = 1] = "NORMAL";
  CommonStatus2[CommonStatus2["ARCHIVED"] = 2] = "ARCHIVED";
  CommonStatus2[CommonStatus2["DELETED"] = 3] = "DELETED";
  return CommonStatus2;
})(CommonStatus || {});
var ErrorCode = /* @__PURE__ */ ((ErrorCode2) => {
  ErrorCode2[ErrorCode2["SUCCESS"] = 200] = "SUCCESS";
  ErrorCode2[ErrorCode2["BAD_REQUEST"] = 400] = "BAD_REQUEST";
  ErrorCode2[ErrorCode2["UNAUTHORIZED"] = 401] = "UNAUTHORIZED";
  ErrorCode2[ErrorCode2["FORBIDDEN"] = 403] = "FORBIDDEN";
  ErrorCode2[ErrorCode2["NOT_FOUND"] = 404] = "NOT_FOUND";
  ErrorCode2[ErrorCode2["CONFLICT"] = 409] = "CONFLICT";
  ErrorCode2[ErrorCode2["TOO_MANY_REQUESTS"] = 429] = "TOO_MANY_REQUESTS";
  ErrorCode2[ErrorCode2["INTERNAL_ERROR"] = 500] = "INTERNAL_ERROR";
  ErrorCode2[ErrorCode2["EMAIL_ALREADY_EXISTS"] = 10001] = "EMAIL_ALREADY_EXISTS";
  ErrorCode2[ErrorCode2["INVALID_CREDENTIALS"] = 10002] = "INVALID_CREDENTIALS";
  ErrorCode2[ErrorCode2["TOKEN_EXPIRED"] = 10003] = "TOKEN_EXPIRED";
  ErrorCode2[ErrorCode2["USER_NOT_FOUND"] = 10004] = "USER_NOT_FOUND";
  ErrorCode2[ErrorCode2["WEAK_PASSWORD"] = 10005] = "WEAK_PASSWORD";
  ErrorCode2[ErrorCode2["CONVERSATION_NOT_FOUND"] = 20001] = "CONVERSATION_NOT_FOUND";
  ErrorCode2[ErrorCode2["CONVERSATION_ACCESS_DENIED"] = 20002] = "CONVERSATION_ACCESS_DENIED";
  ErrorCode2[ErrorCode2["CONVERSATION_ARCHIVED"] = 20003] = "CONVERSATION_ARCHIVED";
  ErrorCode2[ErrorCode2["MESSAGE_NOT_FOUND"] = 30001] = "MESSAGE_NOT_FOUND";
  ErrorCode2[ErrorCode2["MESSAGE_NOT_IN_CONVERSATION"] = 30002] = "MESSAGE_NOT_IN_CONVERSATION";
  ErrorCode2[ErrorCode2["MESSAGE_GENERATION_FAILED"] = 30003] = "MESSAGE_GENERATION_FAILED";
  ErrorCode2[ErrorCode2["UNSUPPORTED_MESSAGE_TYPE"] = 30004] = "UNSUPPORTED_MESSAGE_TYPE";
  ErrorCode2[ErrorCode2["FILE_NOT_FOUND"] = 40001] = "FILE_NOT_FOUND";
  ErrorCode2[ErrorCode2["FILE_TOO_LARGE"] = 40002] = "FILE_TOO_LARGE";
  ErrorCode2[ErrorCode2["UNSUPPORTED_FILE_TYPE"] = 40003] = "UNSUPPORTED_FILE_TYPE";
  ErrorCode2[ErrorCode2["TOOL_EXECUTION_FAILED"] = 50001] = "TOOL_EXECUTION_FAILED";
  ErrorCode2[ErrorCode2["TOOL_EXECUTION_TIMEOUT"] = 50002] = "TOOL_EXECUTION_TIMEOUT";
  ErrorCode2[ErrorCode2["AGENT_EXECUTION_FAILED"] = 50003] = "AGENT_EXECUTION_FAILED";
  ErrorCode2[ErrorCode2["DOCUMENT_NOT_FOUND"] = 60001] = "DOCUMENT_NOT_FOUND";
  ErrorCode2[ErrorCode2["DOCUMENT_PARSE_FAILED"] = 60002] = "DOCUMENT_PARSE_FAILED";
  ErrorCode2[ErrorCode2["RAG_RETRIEVAL_FAILED"] = 60003] = "RAG_RETRIEVAL_FAILED";
  ErrorCode2[ErrorCode2["KNOWLEDGE_BASE_NOT_FOUND"] = 60004] = "KNOWLEDGE_BASE_NOT_FOUND";
  return ErrorCode2;
})(ErrorCode || {});

// src/events/event-bus.ts
var instance = null;
function setEventBus(emitter) {
  instance = emitter;
}
function emit(event, ...args) {
  return instance?.emit(event, ...args) ?? false;
}

// src/events/task-event.ts
var TaskType = /* @__PURE__ */ ((TaskType2) => {
  TaskType2["DOCUMENT_INDEX"] = "document_index";
  TaskType2["RAG_SEARCH"] = "rag_search";
  TaskType2["CHAT"] = "chat";
  return TaskType2;
})(TaskType || {});
var TaskEvent = {
  /** 任务开始 */
  STARTED: "task.started",
  /** 任务进度更新 */
  PROGRESS: "task.progress",
  /** 任务成功完成 */
  COMPLETED: "task.completed",
  /** 任务失败 */
  FAILED: "task.failed"
};
function newTaskId(taskType) {
  return `${taskType}-${globalThis.crypto.randomUUID()}`;
}
async function withTaskEvents(taskType, context, run) {
  const taskId = newTaskId(taskType);
  const startedAt = Date.now();
  emit(TaskEvent.STARTED, { taskId, taskType, ...context });
  try {
    const result = await run(taskId);
    emit(TaskEvent.COMPLETED, { taskId, taskType, durationMs: Date.now() - startedAt, result });
    return result;
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    emit(TaskEvent.FAILED, { taskId, taskType, durationMs: Date.now() - startedAt, error: e.message, stack: e.stack });
    throw err;
  }
}
export {
  CommonStatus,
  ErrorCode,
  TaskEvent,
  TaskType,
  emit,
  newTaskId,
  setEventBus,
  withTaskEvents
};
