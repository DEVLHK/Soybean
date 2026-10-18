import { request } from '../request';

/** get failed bug list */
export function fetchGetFailedBugList(params: Api.ProjectManage.FailedBugSearchParams) {
  return request<Api.Common.PaginatingQueryRecord<Api.ProjectManage.FailedBugRecord>>({
    url: '/projectManage/failedBug/getBugList',
    method: 'get',
    params
  });
}

/** get failed bug comment list (paginated, searchable) */
export function fetchGetBugCommentList(params: Api.ProjectManage.BugCommentSearchParams) {
  return request<Api.Common.PaginatingQueryRecord<Api.ProjectManage.FailedBugComment>>({
    url: '/projectManage/failedBug/getBugCommentList',
    method: 'get',
    params
  });
}

/** get failed bug comment detail (full fields incl. reason/suggestion/commenter) */
export function fetchGetBugCommentDetail(
  params: Pick<Api.ProjectManage.FailedBugComment, 'projectId' | 'bugId' | 'seqNo'>
) {
  return request<Api.ProjectManage.FailedBugComment>({
    url: '/projectManage/failedBug/getBugCommentDetail',
    method: 'get',
    params
  });
}

/** update bug comment (located by joint key projectId+bugId+seqNo) */
export function fetchUpdateBugComment(data: Api.ProjectManage.BugCommentUpdateParams) {
  return request<null>({
    url: '/projectManage/failedBug/updateBugComment',
    method: 'post',
    data
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
