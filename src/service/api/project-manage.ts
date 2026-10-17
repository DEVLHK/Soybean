import { request } from '../request';

/** get failed bug list */
export function fetchGetFailedBugList(params: Api.ProjectManage.FailedBugSearchParams) {
  return request<Api.Common.PaginatingQueryRecord<Api.ProjectManage.FailedBugRecord>>({
    url: '/projectManage/failedBug/getBugList',
    method: 'get',
    params
  });
}

/** get failed bug comment list (locate by joint key projectId + bugId) */
export function fetchGetBugCommentList(params: Pick<Api.ProjectManage.FailedBugRecord, 'projectId' | 'bugId'>) {
  return request<Api.Common.PaginatingQueryRecord<Api.ProjectManage.FailedBugComment>>({
    url: '/projectManage/failedBug/getBugCommentList',
    method: 'get',
    // comments of one bug are few, fetch all in one page
    params: { current: 1, pageSize: 100, ...params }
  });
}

/** review failed bug (locate by joint key projectId + bugId) */
export function fetchReviewBug(data: Pick<Api.ProjectManage.FailedBugRecord, 'projectId' | 'bugId'>) {
  return request<null>({
    url: '/projectManage/failedBug/reviewBug',
    method: 'post',
    data
  });
}
