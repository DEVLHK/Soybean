<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
import { fetchGetRoleButtonAuth, fetchUpdateRoleButtonAuth } from '@/service/api';
import { $t } from '@/locales';

defineOptions({
  name: 'ButtonAuthModal'
});

interface Props {
  /** the roleId */
  roleId: number;
  /** readonly mode for the built-in super role (always full access) */
  readonly?: boolean;
}

const props = defineProps<Props>();

const visible = defineModel<boolean>('visible', {
  default: false
});

function closeModal() {
  visible.value = false;
}

const title = computed(() => $t('common.edit') + $t('page.manage.role.buttonAuth'));

type ButtonTreeNode = {
  /** menu id for menu node, button code for button node */
  key: number | string;
  label: string;
  children?: ButtonTreeNode[];
};

const tree = shallowRef<ButtonTreeNode[]>([]);

const checks = shallowRef<Array<string | number>>([]);

/** echo role button auth: authorized menus (with buttons) as tree, checked codes */
async function getButtonAuth() {
  const { error, data } = await fetchGetRoleButtonAuth(props.roleId);

  if (!error) {
    tree.value = data.menus.map(menu => ({
      key: menu.menuId,
      label: menu.menuName,
      children: menu.buttons.map(button => ({
        key: button.code,
        label: button.desc || button.code
      }))
    }));
    checks.value = data.checkedCodes;
  }
}

async function handleSubmit() {
  // menu node keys are numbers, button node keys are string codes
  const buttonCodes = checks.value.filter((key): key is string => typeof key === 'string');

  const { error } = await fetchUpdateRoleButtonAuth({
    roleId: props.roleId,
    buttonCodes
  });

  if (!error) {
    window.$message?.success?.($t('common.modifySuccess'));

    closeModal();
  }
}

watch(visible, val => {
  if (val) {
    getButtonAuth();
  }
});
</script>

<template>
  <NModal v-model:show="visible" :title="title" preset="card" class="w-480px">
    <NAlert v-if="readonly" type="info" class="mb-12px">
      {{ $t('page.manage.role.superRoleReadonlyTip') }}
    </NAlert>
    <NTree
      v-model:checked-keys="checks"
      :data="tree"
      key-field="key"
      label-field="label"
      :checkable="!readonly"
      expand-on-click
      virtual-scroll
      block-line
      class="h-280px"
    />
    <template #footer>
      <NSpace justify="end">
        <NButton size="small" class="mt-16px" @click="closeModal">
          {{ $t(readonly ? 'common.close' : 'common.cancel') }}
        </NButton>
        <NButton v-if="!readonly" type="primary" size="small" class="mt-16px" @click="handleSubmit">
          {{ $t('common.confirm') }}
        </NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped></style>
