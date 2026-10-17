import { request } from '../request';

/** get failed bug list */
export function fetchGetFailedBugList(params: Api.ProjectManage.FailedBugSearchParams) {
  return request<Api.Common.PaginatingQueryRecord<Api.ProjectManage.FailedBugRecord>>({
    url: '/projectManage/failedBug/getBugList',
    method: 'get',
    params
  });
}

/** review failed bug */
export function fetchReviewBug(id: number) {
  return request<null>({
    url: '/projectManage/failedBug/reviewBug',
    method: 'post',
    data: { id }
  });
}
