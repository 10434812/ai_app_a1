<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-800">用户管理</h1>
      <div class="flex gap-4">
        <input type="text" placeholder="搜索用户..." class="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" v-model="searchQuery" />
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">用户</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">角色</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">注册时间</th>
              <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="user in filteredUsers" :key="user.id" class="hover:bg-gray-50 transition-colors">
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <div class="h-10 w-10 flex-shrink-0">
                    <div class="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                      {{ user.name.charAt(0).toUpperCase() }}
                    </div>
                  </div>
                  <div class="ml-4">
                    <div class="text-sm font-medium text-gray-900">{{ user.name }}</div>
                    <div class="text-sm text-gray-500">{{ user.email }}</div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span
                  :class="[
                    'px-2 inline-flex text-xs leading-5 font-semibold rounded-full',
                    user.role === 'super_admin'
                      ? 'bg-fuchsia-100 text-fuchsia-800'
                      : user.role === 'admin'
                        ? 'bg-purple-100 text-purple-800'
                        : user.role === 'ops'
                          ? 'bg-blue-100 text-blue-800'
                          : user.role === 'finance'
                            ? 'bg-emerald-100 text-emerald-800'
                            : user.role === 'support'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-gray-100 text-gray-800',
                  ]">
                  {{
                    user.role === 'super_admin'
                      ? '超管'
                      : user.role === 'admin'
                        ? '管理员'
                        : user.role === 'ops'
                          ? '运营'
                          : user.role === 'finance'
                            ? '财务'
                            : user.role === 'support'
                              ? '客服'
                              : '普通用户'
                  }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span :class="`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`">
                  {{ user.isActive ? '正常' : '禁用' }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ new Date(user.createdAt).toLocaleDateString() }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div class="flex items-center justify-end gap-3">
                  <button
                    @click="toggleStatus(user)"
                    :disabled="pendingUserActionId === user.id"
                    :class="`text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed ${user.isActive ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}`">
                  {{ user.isActive ? '禁用' : '启用' }}
                  </button>
                  <button
                    @click="removeUser(user)"
                    :disabled="pendingUserActionId === user.id"
                    class="text-sm font-medium text-rose-600 hover:text-rose-800 disabled:opacity-50 disabled:cursor-not-allowed">
                    删除
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {ref, computed, onMounted} from 'vue'
import {deleteUser, getUsers, toggleUserStatus} from '../api/admin'
import type {User} from '../api/admin'

const users = ref<User[]>([])
const searchQuery = ref('')
const pendingUserActionId = ref<string | null>(null)

const extractAdminErrorMessage = (error: any, fallback: string) => {
  const payload = error?.response?.data
  if (typeof payload?.error?.message === 'string' && payload.error.message.trim()) return payload.error.message.trim()
  if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error.trim()
  if (typeof error?.message === 'string' && error.message.trim()) return error.message.trim()
  return fallback
}

const filteredUsers = computed(() => {
  if (!searchQuery.value) return users.value
  const query = searchQuery.value.toLowerCase()
  return users.value.filter((user) => user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query))
})

const fetchUsers = async () => {
  try {
    users.value = await getUsers()
  } catch (error) {
    console.error('Failed to fetch users:', error)
  }
}

const toggleStatus = async (user: User) => {
  pendingUserActionId.value = user.id
  try {
    const updatedUser = await toggleUserStatus(user.id)
    const index = users.value.findIndex((u) => u.id === user.id)
    if (index !== -1) {
      users.value[index] = {...users.value[index], ...updatedUser}
    }
  } catch (error) {
    alert(extractAdminErrorMessage(error, '更新用户状态失败'))
  } finally {
    pendingUserActionId.value = null
  }
}

const removeUser = async (user: User) => {
  const confirmed = window.confirm(`确定删除用户「${user.email}」吗？\n该操作不可撤销。`)
  if (!confirmed) return

  pendingUserActionId.value = user.id
  try {
    await deleteUser(user.id)
    users.value = users.value.filter((u) => u.id !== user.id)
  } catch (error) {
    alert(extractAdminErrorMessage(error, '删除用户失败'))
  } finally {
    pendingUserActionId.value = null
  }
}

onMounted(fetchUsers)
</script>
