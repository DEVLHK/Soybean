<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useBoolean } from '@sa/hooks';
import { jsonClone } from '@sa/utils';
import { enableStatusOptions } from '@/constants/business';
import { fetchAddRole, fetchUpdateRole } from '@/service/api';
import { $t } from '@/locales';
import { useAuth } from '@/hooks/business/auth';
import { useFormRules, useNaiveForm } from '@/hooks/common/form';
import ButtonAuthModal from './button-auth-modal.vue';
import MenuAuthModal from './menu-auth-modal.vue';

defineOptions({
  name: 'RoleOperateDrawer'
});

interface Props {
  /** the type of operation */
  operateType: NaiveUI.TableOperateType;
  /** the edit row data */
  rowData?: Api.SystemManage.Role | null;
}

const props = defineProps<Props>();

interface Emits {
  (e: 'submitted'): void;
}

const emit = defineEmits<Emits>();

const visible = defineModel<boolean>('visible', {
  default: false
});

const { formRef, validate, restoreValidation } = useNaiveForm();
const { defaultRequiredRule } = useFormRules();
const { hasAuth } = useAuth();
const { bool: menuAuthVisible, setTrue: openMenuAuthModal } = useBoolean();
const { bool: buttonAuthVisible, setTrue: openButtonAuthModal } = useBoolean();

const title = computed(() => {
  const titles: Record<NaiveUI.TableOperateType, string> = {
    add: $t('page.manage.role.addRole'),
    edit: $t('page.manage.role.editRole')
  };
  return titles[props.operateType];
});

type Model = Pick<Api.SystemManage.Role, 'roleName' | 'roleCode' | 'roleDesc' | 'status'>;

const model = ref(createDefaultModel());

function createDefaultModel(): Model {
  return {
    roleName: '',
    roleCode: '',
    roleDesc: '',
    status: null
  };
}

type RuleKey = Exclude<keyof Model, 'roleDesc'>;

const rules: Record<RuleKey, App.Global.FormRule> = {
  roleName: defaultRequiredRule,
  roleCode: defaultRequiredRule,
  status: defaultRequiredRule
};

const roleId = computed(() => props.rowData?.id || -1);

const isEdit = computed(() => props.operateType === 'edit');

/** R_SUPER is the built-in super role: menu/button auth is always full and read-only */
const isSuperRole = computed(() => props.rowData?.roleCode === 'R_SUPER');

function handleInitModel() {
  model.value = createDefaultModel();

  if (props.operateType === 'edit' && props.rowData) {
    Object.assign(model.value, jsonClone(props.rowData));
  }
}

function closeDrawer() {
  visible.value = false;
}

async function handleSubmit() {
  await validate();

  const { error } = isEdit.value
    ? await fetchUpdateRole({ ...model.value, id: props.rowData!.id })
    : await fetchAddRole(model.value);

  if (!error) {
    window.$message?.success($t(props.operateType === 'add' ? 'common.addSuccess' : 'common.updateSuccess'));
    closeDrawer();
    emit('submitted');
  }
}

watch(visible, () => {
  if (visible.value) {
    handleInitModel();
    restoreValidation();
  }
});
</script>

<template>
  <NDrawer v-model:show="visible" display-directive="show" :width="360">
    <NDrawerContent :title="title" :native-scrollbar="false" closable>
      <NForm ref="formRef" :model="model" :rules="rules">
        <NFormItem :label="$t('page.manage.role.roleCode')" path="roleCode">
          <NInput
            v-model:value="model.roleCode"
            :disabled="isEdit"
            :placeholder="$t('page.manage.role.form.roleCode')"
          />
        </NFormItem>
        <NFormItem :label="$t('page.manage.role.roleName')" path="roleName">
          <NInput v-model:value="model.roleName" :placeholder="$t('page.manage.role.form.roleName')" />
        </NFormItem>
        <NFormItem :label="$t('page.manage.role.roleDesc')" path="roleDesc">
          <NInput v-model:value="model.roleDesc" :placeholder="$t('page.manage.role.form.roleDesc')" />
        </NFormItem>
        <NFormItem :label="$t('page.manage.role.roleStatus')" path="status">
          <NRadioGroup v-model:value="model.status" :disabled="isSuperRole">
            <NRadio v-for="item in enableStatusOptions" :key="item.value" :value="item.value" :label="$t(item.label)" />
          </NRadioGroup>
        </NFormItem>
      </NForm>
      <NSpace v-if="isEdit">
        <NButton v-if="hasAuth('B_ROLE::BTN_MENU_AUTH')" @click="openMenuAuthModal">
          {{ $t('page.manage.role.menuAuth') }}
        </NButton>
        <MenuAuthModal v-model:visible="menuAuthVisible" :role-id="roleId" :readonly="isSuperRole" />
        <NButton v-if="hasAuth('B_ROLE::BTN_BUTTON_AUTH')" @click="openButtonAuthModal">
          {{ $t('page.manage.role.buttonAuth') }}
        </NButton>
        <ButtonAuthModal v-model:visible="buttonAuthVisible" :role-id="roleId" :readonly="isSuperRole" />
      </NSpace>
      <template #footer>
        <NSpace :size="16">
          <NButton @click="closeDrawer">{{ $t('common.cancel') }}</NButton>
          <NButton type="primary" @click="handleSubmit">{{ $t('common.confirm') }}</NButton>
        </NSpace>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped></style>
