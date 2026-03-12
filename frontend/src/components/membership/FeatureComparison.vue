<script setup lang="ts">
const features = [
  {name: '每日对话次数', free: '10次', pro: '无限', premium: '无限'},
  {name: '可用模型', free: '基础模型', pro: '主流模型', premium: '全模型优先'},
  {name: '上下文长度', free: '8k', pro: '32k', premium: '128k'},
  {name: '响应速度', free: '标准', pro: '极速', premium: '极速优先'},
  {name: '每月 Token 配额', free: '100', pro: '20,000', premium: '100,000'},
  {name: '并发请求数', free: '3', pro: '3', premium: '4'},
  {name: '工具调用额度', free: '20/天', pro: '200/天', premium: '1000/天'},
  {name: '客服支持', free: '社区', pro: '邮件', premium: '优先工单'},
]
</script>

<template>
  <div class="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
    <div class="p-6 sm:p-8 border-b border-slate-200 dark:border-slate-700">
      <h3 class="text-xl font-bold text-slate-800 dark:text-white text-center">功能详细对比</h3>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-sm text-left">
        <thead>
          <tr class="bg-slate-50/50 dark:bg-slate-900/50">
            <th class="px-6 py-4 font-medium text-slate-500 dark:text-slate-400">功能特性</th>
            <th class="px-6 py-4 font-bold text-slate-700 dark:text-slate-300 text-center">免费版</th>
            <th class="px-6 py-4 font-bold text-indigo-600 dark:text-indigo-400 text-center">专业版</th>
            <th class="px-6 py-4 font-bold text-amber-600 dark:text-amber-400 text-center">高级版</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200 dark:divide-slate-700">
          <tr v-for="(row, idx) in features" :key="idx" class="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
            <td class="px-6 py-4 font-medium text-slate-700 dark:text-slate-300">{{ row.name }}</td>
            <td class="px-6 py-4 text-center text-slate-600 dark:text-slate-400">{{ row.free }}</td>
            <td class="px-6 py-4 text-center text-slate-600 dark:text-slate-400 font-medium bg-indigo-50/10 dark:bg-indigo-900/10">{{ row.pro }}</td>
            <td class="px-6 py-4 text-center text-slate-600 dark:text-slate-400">{{ row.premium }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
