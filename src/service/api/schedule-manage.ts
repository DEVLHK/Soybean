import { getServiceBaseURL } from '@/utils/service';
import { request } from '../request';

/** get scheduler job list */
export function fetchGetSchedulerJobList(params: Api.ScheduleManage.SchedulerJobSearchParams) {
  return request<Api.Common.PaginatingQueryRecord<Api.ScheduleManage.SchedulerJobRecord>>({
    url: '/scheduleManage/getSchedulerJobList',
    method: 'get',
    params
  });
}

/** get scheduler job detail */
export function fetchGetSchedulerJobDetail(id: number) {
  return request<Api.ScheduleManage.SchedulerJobRecord>({
    url: '/scheduleManage/getSchedulerJobDetail',
    method: 'get',
    params: { id }
  });
}

/** add scheduler job */
export function fetchAddSchedulerJob(data: Api.ScheduleManage.SchedulerJobAddParams) {
  return request<null>({
    url: '/scheduleManage/addSchedulerJob',
    method: 'post',
    data
  });
}

/** update scheduler job */
export function fetchUpdateSchedulerJob(data: Api.ScheduleManage.SchedulerJobUpdateParams) {
  return request<null>({
    url: '/scheduleManage/updateSchedulerJob',
    method: 'post',
    data
  });
}

/** delete scheduler job */
export function fetchDeleteSchedulerJob(id: number) {
  return request<null>({
    url: '/scheduleManage/deleteSchedulerJob',
    method: 'post',
    data: { id }
  });
}

/** start scheduler job */
export function fetchStartSchedulerJob(id: number) {
  return request<null>({
    url: '/scheduleManage/startSchedulerJob',
    method: 'post',
    data: { id }
  });
}

/** stop scheduler job */
export function fetchStopSchedulerJob(id: number) {
  return request<null>({
    url: '/scheduleManage/stopSchedulerJob',
    method: 'post',
    data: { id }
  });
}

/** run scheduler job once immediately */
export function fetchRunSchedulerJobOnce(id: number) {
  return request<null>({
    url: '/scheduleManage/runSchedulerJobOnce',
    method: 'post',
    data: { id }
  });
}

/** get scheduler job run log (paginated) */
export function fetchGetSchedulerJobRunLog(params: Api.ScheduleManage.SchedulerJobRunLogSearchParams) {
  return request<Api.Common.PaginatingQueryRecord<Api.ScheduleManage.SchedulerJobRunLogRecord>>({
    url: '/scheduleManage/getSchedulerJobRunLog',
    method: 'get',
    params
  });
}

/**
 * get run log content line by line.
 * first request without before/after returns the last `limit` lines;
 * `before` = current startLine - 1 loads earlier lines;
 * `after` = current endLine loads/polls newer lines
 */
export function fetchSchedulerJobRunLogContent(params: {
  id: number;
  limit?: number;
  before?: number;
  after?: number;
}) {
  return request<Api.ScheduleManage.SchedulerJobRunLogContent>({
    url: '/scheduleManage/getSchedulerJobRunLogContent',
    method: 'get',
    params
  });
}

/** download the full run log file (text/plain stream, no auth needed) */
export function getSchedulerJobRunLogDownloadUrl(id: number) {
  const isHttpProxy = import.meta.env.DEV && import.meta.env.VITE_HTTP_PROXY === 'Y';
  const { baseURL } = getServiceBaseURL(import.meta.env, isHttpProxy);
  return `${baseURL}/scheduleManage/downloadSchedulerJobRunLog?id=${id}`;
}

/** get script info list */
export function fetchGetScriptInfoList(params: Api.ScheduleManage.ScriptInfoSearchParams) {
  return request<Api.Common.PaginatingQueryRecord<Api.ScheduleManage.ScriptInfoRecord>>({
    url: '/scheduleManage/getScriptInfoList',
    method: 'get',
    params
  });
}

/** get script info detail (by primary key scriptName) */
export function fetchGetScriptInfoDetail(scriptName: string) {
  return request<Api.ScheduleManage.ScriptInfoRecord>({
    url: '/scheduleManage/getScriptInfoDetail',
    method: 'get',
    params: { scriptName }
  });
}

/** add script info (multipart: upload the .py file, saved by backend to scriptPath) */
export function fetchAddScriptInfo(data: Api.ScheduleManage.ScriptInfoAddParams, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('scriptName', data.scriptName);
  formData.append('scriptPath', data.scriptPath);
  formData.append('description', data.description ?? '');
  formData.append('params', JSON.stringify(data.params ?? []));
  return request<null>({
    url: '/scheduleManage/addScriptInfo',
    method: 'post',
    data: formData
  });
}

/** update script info (located by scriptName) */
export function fetchUpdateScriptInfo(data: Api.ScheduleManage.ScriptInfoUpdateParams) {
  return request<null>({
    url: '/scheduleManage/updateScriptInfo',
    method: 'post',
    data
  });
}

/** delete script info (by primary key scriptName) */
export function fetchDeleteScriptInfo(scriptName: string) {
  return request<null>({
    url: '/scheduleManage/deleteScriptInfo',
    method: 'post',
    data: { scriptName }
  });
}
