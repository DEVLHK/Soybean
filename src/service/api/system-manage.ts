import { request } from '../request';

/** get role list */
export function fetchGetRoleList(params?: Api.SystemManage.RoleSearchParams) {
  return request<Api.SystemManage.RoleList>({
    url: '/systemManage/getRoleList',
    method: 'get',
    params
  });
}

/**
 * get all roles
 *
 * these roles are all enabled
 */
export function fetchGetAllRoles() {
  return request<Api.SystemManage.AllRole[]>({
    url: '/systemManage/getAllRoles',
    method: 'get'
  });
}

/** get user list */
export function fetchGetUserList(params?: Api.SystemManage.UserSearchParams) {
  return request<Api.SystemManage.UserList>({
    url: '/systemManage/getUserList',
    method: 'get',
    params
  });
}

/** get menu list */
export function fetchGetMenuList() {
  return request<Api.SystemManage.MenuList>({
    url: '/systemManage/getMenuList/v2',
    method: 'get'
  });
}

/** get all pages */
export function fetchGetAllPages() {
  return request<string[]>({
    url: '/systemManage/getAllPages',
    method: 'get'
  });
}

/** get menu tree */
export function fetchGetMenuTree() {
  return request<Api.SystemManage.MenuTree[]>({
    url: '/systemManage/getMenuTree',
    method: 'get'
  });
}

/** add user */
export function fetchAddUser(data: Api.SystemManage.UserAddParams) {
  return request<null>({
    url: '/systemManage/addUser',
    method: 'post',
    data
  });
}

/** update user */
export function fetchUpdateUser(data: Api.SystemManage.UserUpdateParams) {
  return request<null>({
    url: '/systemManage/updateUser',
    method: 'post',
    data
  });
}

/** delete user */
export function fetchDeleteUser(id: number) {
  return request<null>({
    url: '/systemManage/deleteUser',
    method: 'post',
    data: { id }
  });
}

/** batch delete users */
export function fetchBatchDeleteUser(ids: number[]) {
  return request<null>({
    url: '/systemManage/batchDeleteUser',
    method: 'post',
    data: { ids }
  });
}

/** add role */
export function fetchAddRole(data: Api.SystemManage.RoleOperateParams) {
  return request<null>({
    url: '/systemManage/addRole',
    method: 'post',
    data
  });
}

/** update role */
export function fetchUpdateRole(data: Api.SystemManage.RoleOperateParams & Pick<Api.SystemManage.Role, 'id'>) {
  return request<null>({
    url: '/systemManage/updateRole',
    method: 'post',
    data
  });
}

/** delete role */
export function fetchDeleteRole(id: number) {
  return request<null>({
    url: '/systemManage/deleteRole',
    method: 'post',
    data: { id }
  });
}

/** batch delete roles */
export function fetchBatchDeleteRole(ids: number[]) {
  return request<null>({
    url: '/systemManage/batchDeleteRole',
    method: 'post',
    data: { ids }
  });
}

/** add menu */
export function fetchAddMenu(data: Api.SystemManage.MenuAddParams) {
  return request<null>({
    url: '/systemManage/addMenu',
    method: 'post',
    data
  });
}

/** update menu */
export function fetchUpdateMenu(data: Api.SystemManage.MenuUpdateParams) {
  return request<null>({
    url: '/systemManage/updateMenu',
    method: 'post',
    data
  });
}

/** delete menu */
export function fetchDeleteMenu(id: number) {
  return request<null>({
    url: '/systemManage/deleteMenu',
    method: 'post',
    data: { id }
  });
}

/** get role menu auth */
export function fetchGetRoleMenuAuth(roleId: number) {
  return request<Api.SystemManage.RoleMenuAuth>({
    url: '/systemManage/getRoleMenuAuth',
    method: 'get',
    params: { roleId }
  });
}

/** update role menu auth */
export function fetchUpdateRoleMenuAuth(data: Api.SystemManage.RoleMenuAuthUpdateParams) {
  return request<null>({
    url: '/systemManage/updateRoleMenuAuth',
    method: 'post',
    data
  });
}

/** get role button auth */
export function fetchGetRoleButtonAuth(roleId: number) {
  return request<Api.SystemManage.RoleButtonAuth>({
    url: '/systemManage/getRoleButtonAuth',
    method: 'get',
    params: { roleId }
  });
}

/** update role button auth */
export function fetchUpdateRoleButtonAuth(data: Api.SystemManage.RoleButtonAuthUpdateParams) {
  return request<null>({
    url: '/systemManage/updateRoleButtonAuth',
    method: 'post',
    data
  });
}
