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
