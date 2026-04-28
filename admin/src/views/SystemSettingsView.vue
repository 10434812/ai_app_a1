<template>
  <div class="max-w-4xl mx-auto space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-800">系统设置</h1>
      <div class="flex items-center gap-3">
        <input
          ref="importInput"
          type="file"
          accept="application/json,.json"
          class="hidden"
          @change="handleImportFile" />
        <button
          @click="downloadConfig"
          :disabled="configTransferring"
          class="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 text-sm transition-colors">
          导出配置
        </button>
        <button
          @click="openImportPicker"
          :disabled="configTransferring"
          class="px-4 py-2 bg-white border border-indigo-200 text-indigo-700 rounded-md hover:bg-indigo-50 disabled:opacity-50 text-sm transition-colors">
          导入配置
        </button>
        <button @click="saveSettings" :disabled="saving" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 text-sm transition-colors">
          <svg v-if="saving" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span v-else>保存设置</span>
        </button>
      </div>
    </div>

    <div class="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700">
      这里的模型配置、系统设置、图片配置、计费配置都可以直接导出成 JSON。服务器部署后，在后台点“导入配置”即可一次性恢复，不需要重新手工填写。
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="p-6 space-y-8">
        <!-- Site Configuration -->
        <div>
          <h2 class="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
            <svg class="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            站点配置
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="col-span-2 md:col-span-1">
              <label class="block text-sm font-medium text-gray-700 mb-1">站点名称</label>
              <input v-model="settings.site_name" type="text" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="例如：AI 智能助手" />
              <p class="mt-1 text-xs text-gray-500">显示在浏览器标题和顶栏的名称。</p>
            </div>

            <div class="col-span-2 md:col-span-1">
              <label class="block text-sm font-medium text-gray-700 mb-1">新用户注册送额</label>
              <div class="relative rounded-md shadow-sm">
                <input v-model="settings.default_quota" type="number" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm pr-16" placeholder="5000" />
                <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <span class="text-gray-500 sm:text-sm">Token</span>
                </div>
              </div>
              <p class="mt-1 text-xs text-gray-500">新用户注册时发放的初始 Token。建议不少于 5000，才能覆盖多模型并发和生图的基础体验。</p>
            </div>

            <div class="col-span-2 md:col-span-1">
              <label class="block text-sm font-medium text-gray-700 mb-1">游客试用次数</label>
              <div class="relative rounded-md shadow-sm">
                <input v-model="settings.guest_trial_limit" type="number" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm pr-12" placeholder="100" />
                <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <span class="text-gray-500 sm:text-sm">次</span>
                </div>
              </div>
              <p class="mt-1 text-xs text-gray-500">未登录用户允许的免费对话次数，达到限制后提示注册。</p>
            </div>

            <div class="col-span-2 md:col-span-1">
              <label class="block text-sm font-medium text-gray-700 mb-1">多模型试用次数</label>
              <div class="relative rounded-md shadow-sm">
                <input v-model="settings.multi_model_trial_limit" type="number" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm pr-12" placeholder="10" />
                <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <span class="text-gray-500 sm:text-sm">次</span>
                </div>
              </div>
              <p class="mt-1 text-xs text-gray-500">非会员用户选择3个以上模型的免费试用次数。</p>
            </div>

            <div class="col-span-2">
              <label class="block text-sm font-medium text-gray-700 mb-1">欢迎语</label>
              <textarea v-model="settings.welcome_message" rows="3" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="欢迎使用本系统..."></textarea>
              <p class="mt-1 text-xs text-gray-500">新会话开始时显示的默认欢迎消息。</p>
            </div>

            <div class="col-span-2 md:col-span-1">
              <label class="block text-sm font-medium text-gray-700 mb-1">AppID</label>
              <input v-model="settings.WECHAT_APP_ID" type="text" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="wx..." />
              <p class="mt-1 text-xs text-gray-500">微信公众号 AppID，用于网页授权登录。</p>
            </div>

            <div class="col-span-2 md:col-span-1">
              <label class="block text-sm font-medium text-gray-700 mb-1">AppSecret</label>
              <input v-model="settings.WECHAT_APP_SECRET" type="password" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="......" />
              <p class="mt-1 text-xs text-gray-500">微信公众号 AppSecret，请妥善保管。</p>
            </div>
            
            <div class="col-span-2">
              <label class="block text-sm font-medium text-gray-700 mb-1">分享标题</label>
              <input v-model="settings.WECHAT_SHARE_TITLE" type="text" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="AI 智能助手" />
            </div>

            <div class="col-span-2">
              <label class="block text-sm font-medium text-gray-700 mb-1">分享描述</label>
              <textarea v-model="settings.WECHAT_SHARE_DESC" rows="2" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="汇聚全球顶尖大模型..."></textarea>
            </div>

            <div class="col-span-2">
              <label class="block text-sm font-medium text-gray-700 mb-1">分享图标 URL</label>
              <input v-model="settings.WECHAT_SHARE_IMG" type="text" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="https://example.com/logo.png" />
              <p class="mt-1 text-xs text-gray-500">必须是完整的 HTTPS 链接。</p>
            </div>

            <div class="col-span-2">
              <label class="block text-sm font-medium text-gray-700 mb-1">分享链接地址</label>
              <input v-model="settings.WECHAT_SHARE_LINK" type="text" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="留空则默认使用当前页面链接" />
              <p class="mt-1 text-xs text-gray-500">可指定分享卡片点击后跳转的固定链接（如首页）。</p>
            </div>
          </div>
        </div>

        <hr class="border-gray-100" />

        <div>
          <h2 class="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
            <svg class="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a5 5 0 00-10 0v2M5 9h14l-1 10a2 2 0 01-2 2H8a2 2 0 01-2-2L5 9z" />
            </svg>
            微信支付
          </h2>
          <div class="space-y-4">
            <div class="flex items-center justify-between p-4 bg-emerald-50 rounded-lg border border-emerald-100">
              <div>
                <h3 class="text-sm font-medium text-gray-900">启用微信支付</h3>
                <p class="text-xs text-gray-500 mt-1">桌面端走 Native 二维码，微信内浏览器自动走 JSAPI。</p>
              </div>
              <button
                @click="settings.WECHAT_PAY_ENABLED = settings.WECHAT_PAY_ENABLED === 'true' ? 'false' : 'true'"
                :class="[
                  settings.WECHAT_PAY_ENABLED === 'true' ? 'bg-emerald-600' : 'bg-gray-200',
                  'relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none',
                ]">
                <span aria-hidden="true" :class="[settings.WECHAT_PAY_ENABLED === 'true' ? 'translate-x-5' : 'translate-x-0', 'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition ease-in-out duration-200']"></span>
              </button>
            </div>

            <div class="flex items-center justify-between p-4 bg-amber-50 rounded-lg border border-amber-100">
              <div>
                <h3 class="text-sm font-medium text-gray-900">调试模拟支付</h3>
                <p class="text-xs text-gray-500 mt-1">开发环境可以开启。生产环境建议关闭，否则不会走真实微信支付。</p>
              </div>
              <button
                @click="settings.WECHAT_PAY_MOCK_MODE = settings.WECHAT_PAY_MOCK_MODE === 'true' ? 'false' : 'true'"
                :class="[
                  settings.WECHAT_PAY_MOCK_MODE === 'true' ? 'bg-amber-500' : 'bg-gray-200',
                  'relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none',
                ]">
                <span aria-hidden="true" :class="[settings.WECHAT_PAY_MOCK_MODE === 'true' ? 'translate-x-5' : 'translate-x-0', 'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition ease-in-out duration-200']"></span>
              </button>
            </div>

            <div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 class="text-sm font-medium text-gray-900">微信支付配置检测</h3>
                  <p class="mt-1 text-xs text-gray-500">点击后会用当前表单里的配置直接测试，不需要先保存。生产模式会真实校验证书、私钥和 APIv3 Key。</p>
                </div>
                <button
                  @click="runWeChatPayTest"
                  :disabled="testingWeChatPay"
                  class="inline-flex items-center justify-center rounded-md border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50">
                  <svg v-if="testingWeChatPay" class="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  测试微信支付配置
                </button>
              </div>
              <div
                v-if="wechatPayTestResult"
                :class="[
                  wechatPayTestResult.success ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-700',
                  'mt-3 rounded-md border px-4 py-3 text-sm',
                ]">
                <div class="font-medium">{{ wechatPayTestResult.message }}</div>
                <div class="mt-1 text-xs opacity-80">
                  模式：{{ wechatPayTestResult.mode === 'mock' ? '模拟支付' : '真实微信支付' }}
                  <span v-if="wechatPayTestResult.merchantSerialNo"> · 商户证书序列号：{{ wechatPayTestResult.merchantSerialNo }}</span>
                  <span v-if="wechatPayTestResult.certificateCount !== undefined"> · 平台证书：{{ wechatPayTestResult.certificateCount }} 张</span>
                </div>
                <div v-if="wechatPayTestResult.missing?.length" class="mt-1 text-xs opacity-80">
                  缺失项：{{ wechatPayTestResult.missing.join('、') }}
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">支付 AppID</label>
                <input v-model="settings.WECHAT_PAY_APP_ID" type="text" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="wx..." />
                <p class="mt-1 text-xs text-gray-500">用于 JSAPI 支付，通常与公众号登录的 AppID 保持一致。</p>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">商户号 MCHID</label>
                <input v-model="settings.WECHAT_PAY_MCH_ID" type="text" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="190000****" />
              </div>

              <div class="md:col-span-2">
                <label class="block text-sm font-medium text-gray-700 mb-1">支付回调地址 Notify URL</label>
                <input v-model="settings.WECHAT_PAY_NOTIFY_URL" type="text" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="https://api.yourdomain.com/api/payment/wechat/notify" />
                <p class="mt-1 text-xs text-gray-500">必须是公网 HTTPS 地址，且要和后端实际 API 域名一致。</p>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">APIv3 密钥</label>
                <input v-model="settings.WECHAT_PAY_API_V3_KEY" type="password" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="32位 APIv3 Key" />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">商户证书序列号</label>
                <input v-model="settings.WECHAT_PAY_CERT_SERIAL_NO" type="text" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="可留空，系统会尝试从证书内容推导" />
              </div>

              <div class="md:col-span-2">
                <label class="block text-sm font-medium text-gray-700 mb-1">商户证书 PEM 内容</label>
                <textarea v-model="settings.WECHAT_PAY_CERT_PEM" rows="6" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm font-mono" placeholder="-----BEGIN CERTIFICATE-----"></textarea>
                <p class="mt-1 text-xs text-gray-500">粘贴 apiclient_cert.pem 的完整内容。</p>
              </div>

              <div class="md:col-span-2">
                <label class="block text-sm font-medium text-gray-700 mb-1">商户 API 私钥 PEM 内容</label>
                <textarea v-model="settings.WECHAT_PAY_PRIVATE_KEY" rows="8" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm font-mono" placeholder="-----BEGIN PRIVATE KEY-----"></textarea>
                <p class="mt-1 text-xs text-gray-500">粘贴 apiclient_key.pem 的完整内容。导入服务器时会一起同步，不需要再手传证书文件。</p>
              </div>
            </div>
          </div>
        </div>

        <hr class="border-gray-100" />

        <!-- Access Control -->
        <div>
          <h2 class="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
            <svg class="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            访问控制
          </h2>
          <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div>
              <h3 class="text-sm font-medium text-gray-900">开放注册</h3>
              <p class="text-xs text-gray-500 mt-1">允许新用户自行注册账号。关闭后仅管理员可添加用户。</p>
            </div>
            <button
              @click="settings.enable_registration = settings.enable_registration === 'true' ? 'false' : 'true'"
              :class="[
                settings.enable_registration === 'true' ? 'bg-indigo-600' : 'bg-gray-200',
                'relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500',
              ]">
              <span class="sr-only">Toggle registration</span>
              <span aria-hidden="true" :class="[settings.enable_registration === 'true' ? 'translate-x-5' : 'translate-x-0', 'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200']"></span>
            </button>
          </div>
        </div>

        <hr class="border-gray-100" />

        <!-- Dynamic Rate Limit -->
        <div>
          <h2 class="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
            <svg class="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            动态限流
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">高峰时段</label>
              <input v-model="settings.RATE_LIMIT_PEAK_HOURS" type="text" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="09-23" />
              <p class="mt-1 text-xs text-gray-500">格式：起始小时-结束小时（例如 09-23）。</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">高峰倍率 / 低峰倍率</label>
              <div class="grid grid-cols-2 gap-2">
                <input v-model="settings.RATE_LIMIT_PEAK_FACTOR" type="number" step="0.1" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="0.9" />
                <input v-model="settings.RATE_LIMIT_OFFPEAK_FACTOR" type="number" step="0.1" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="1.15" />
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">会员倍率（free/pro/premium）</label>
              <div class="grid grid-cols-3 gap-2">
                <input v-model="settings.RATE_LIMIT_FACTOR_FREE" type="number" step="0.1" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="1" />
                <input v-model="settings.RATE_LIMIT_FACTOR_PRO" type="number" step="0.1" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="1.6" />
                <input v-model="settings.RATE_LIMIT_FACTOR_PREMIUM" type="number" step="0.1" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="2.4" />
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">信誉阈值 / 惩罚倍率</label>
              <div class="grid grid-cols-2 gap-2">
                <input v-model="settings.RATE_LIMIT_REPUTATION_THRESHOLD" type="number" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="20" />
                <input v-model="settings.RATE_LIMIT_REPUTATION_PENALTY" type="number" step="0.1" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="0.7" />
              </div>
            </div>
            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-gray-700 mb-1">IP 白名单 / 黑名单</label>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                <textarea v-model="settings.RATE_LIMIT_WHITELIST_IPS" rows="2" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="127.0.0.1, 1.2.3.4"></textarea>
                <textarea v-model="settings.RATE_LIMIT_BLACKLIST_IPS" rows="2" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="恶意 IP 列表"></textarea>
              </div>
            </div>
            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-gray-700 mb-1">用户白名单 / 黑名单（用户ID）</label>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                <textarea v-model="settings.RATE_LIMIT_WHITELIST_USERS" rows="2" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="用户ID 列表"></textarea>
                <textarea v-model="settings.RATE_LIMIT_BLACKLIST_USERS" rows="2" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="用户ID 列表"></textarea>
              </div>
            </div>
          </div>
        </div>

        <hr class="border-gray-100" />

        <!-- Data Governance -->
        <div>
          <h2 class="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
            <svg class="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 1.343-3 3m0 0c0 1.657 1.343 3 3 3m-3-3h6m2 9H7a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v12a2 2 0 01-2 2z" />
            </svg>
            数据治理
          </h2>
          <div class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">归档阈值（天）</label>
                <input
                  v-model.number="archiveDays"
                  type="number"
                  min="7"
                  max="3650"
                  class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
              </div>
              <button
                @click="runArchiveDryRun"
                :disabled="archiving"
                class="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 text-sm">
                预览归档量
              </button>
              <button
                @click="runArchiveNow"
                :disabled="archiving"
                class="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50 text-sm">
                执行归档
              </button>
            </div>

            <div v-if="archivePreview" class="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              <div>截止时间：{{ new Date(archivePreview.cutoff).toLocaleString() }}</div>
              <div class="mt-2">候选数据量：</div>
              <div class="mt-1 font-mono text-xs">
                messages={{ archivePreview.candidates.messages || 0 }},
                token_usage_records={{ archivePreview.candidates.token_usage_records || 0 }},
                visit_logs={{ archivePreview.candidates.visit_logs || 0 }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Notification -->
    <div v-if="showNotification" class="fixed bottom-4 right-4 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 transition-all duration-300 transform translate-y-0">
      <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
      <span class="text-sm font-medium">设置已保存</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import {ref, onMounted} from 'vue'
import {archiveData, exportSystemConfig, getGeneralSettings, importSystemConfig, testWeChatPayConfig, updateGeneralSettings} from '../api/admin'
import type {ConfigExportPayload, GeneralSettings, WeChatPayTestResult} from '../api/admin'
import {extractThrownErrorMessage} from '../utils/apiError'

type BaseSystemSettings = Pick<
  GeneralSettings,
  | 'site_name'
  | 'enable_registration'
  | 'default_quota'
  | 'welcome_message'
  | 'guest_trial_limit'
  | 'multi_model_trial_limit'
  | 'WECHAT_APP_ID'
  | 'WECHAT_APP_SECRET'
  | 'WECHAT_SHARE_TITLE'
  | 'WECHAT_SHARE_DESC'
  | 'WECHAT_SHARE_IMG'
  | 'WECHAT_SHARE_LINK'
  | 'WECHAT_PAY_ENABLED'
  | 'WECHAT_PAY_MOCK_MODE'
  | 'WECHAT_PAY_APP_ID'
  | 'WECHAT_PAY_MCH_ID'
  | 'WECHAT_PAY_API_V3_KEY'
  | 'WECHAT_PAY_CERT_SERIAL_NO'
  | 'WECHAT_PAY_CERT_PEM'
  | 'WECHAT_PAY_PRIVATE_KEY'
  | 'WECHAT_PAY_NOTIFY_URL'
  | 'RATE_LIMIT_WHITELIST_IPS'
  | 'RATE_LIMIT_BLACKLIST_IPS'
  | 'RATE_LIMIT_WHITELIST_USERS'
  | 'RATE_LIMIT_BLACKLIST_USERS'
  | 'RATE_LIMIT_PEAK_HOURS'
  | 'RATE_LIMIT_PEAK_FACTOR'
  | 'RATE_LIMIT_OFFPEAK_FACTOR'
  | 'RATE_LIMIT_REPUTATION_THRESHOLD'
  | 'RATE_LIMIT_REPUTATION_PENALTY'
  | 'RATE_LIMIT_FACTOR_FREE'
  | 'RATE_LIMIT_FACTOR_PRO'
  | 'RATE_LIMIT_FACTOR_PREMIUM'
>

const settings = ref<BaseSystemSettings>({
  site_name: '',
  enable_registration: 'true',
  default_quota: '5000',
  welcome_message: '',
  guest_trial_limit: '100',
  multi_model_trial_limit: '10',
  WECHAT_APP_ID: '',
  WECHAT_APP_SECRET: '',
  WECHAT_SHARE_TITLE: '',
  WECHAT_SHARE_DESC: '',
  WECHAT_SHARE_IMG: '',
  WECHAT_SHARE_LINK: '',
  WECHAT_PAY_ENABLED: 'false',
  WECHAT_PAY_MOCK_MODE: 'true',
  WECHAT_PAY_APP_ID: '',
  WECHAT_PAY_MCH_ID: '',
  WECHAT_PAY_API_V3_KEY: '',
  WECHAT_PAY_CERT_SERIAL_NO: '',
  WECHAT_PAY_CERT_PEM: '',
  WECHAT_PAY_PRIVATE_KEY: '',
  WECHAT_PAY_NOTIFY_URL: '',
  RATE_LIMIT_WHITELIST_IPS: '',
  RATE_LIMIT_BLACKLIST_IPS: '',
  RATE_LIMIT_WHITELIST_USERS: '',
  RATE_LIMIT_BLACKLIST_USERS: '',
  RATE_LIMIT_PEAK_HOURS: '09-23',
  RATE_LIMIT_PEAK_FACTOR: '0.9',
  RATE_LIMIT_OFFPEAK_FACTOR: '1.15',
  RATE_LIMIT_REPUTATION_THRESHOLD: '20',
  RATE_LIMIT_REPUTATION_PENALTY: '0.7',
  RATE_LIMIT_FACTOR_FREE: '1',
  RATE_LIMIT_FACTOR_PRO: '1.6',
  RATE_LIMIT_FACTOR_PREMIUM: '2.4',
})

const saving = ref(false)
const showNotification = ref(false)
const archiving = ref(false)
const archiveDays = ref(180)
const archivePreview = ref<{cutoff: string; candidates: Record<string, number>} | null>(null)
const configTransferring = ref(false)
const importInput = ref<HTMLInputElement | null>(null)
const testingWeChatPay = ref(false)
const wechatPayTestResult = ref<WeChatPayTestResult | null>(null)

const fetchSettings = async () => {
  try {
    const allSettings = await getGeneralSettings()
    settings.value = {
      site_name: allSettings.site_name,
      enable_registration: allSettings.enable_registration,
      default_quota: allSettings.default_quota,
      welcome_message: allSettings.welcome_message,
      guest_trial_limit: allSettings.guest_trial_limit,
      multi_model_trial_limit: allSettings.multi_model_trial_limit,
      WECHAT_APP_ID: allSettings.WECHAT_APP_ID,
      WECHAT_APP_SECRET: allSettings.WECHAT_APP_SECRET,
      WECHAT_SHARE_TITLE: allSettings.WECHAT_SHARE_TITLE,
      WECHAT_SHARE_DESC: allSettings.WECHAT_SHARE_DESC,
      WECHAT_SHARE_IMG: allSettings.WECHAT_SHARE_IMG,
      WECHAT_SHARE_LINK: allSettings.WECHAT_SHARE_LINK,
      WECHAT_PAY_ENABLED: allSettings.WECHAT_PAY_ENABLED,
      WECHAT_PAY_MOCK_MODE: allSettings.WECHAT_PAY_MOCK_MODE,
      WECHAT_PAY_APP_ID: allSettings.WECHAT_PAY_APP_ID,
      WECHAT_PAY_MCH_ID: allSettings.WECHAT_PAY_MCH_ID,
      WECHAT_PAY_API_V3_KEY: allSettings.WECHAT_PAY_API_V3_KEY,
      WECHAT_PAY_CERT_SERIAL_NO: allSettings.WECHAT_PAY_CERT_SERIAL_NO,
      WECHAT_PAY_CERT_PEM: allSettings.WECHAT_PAY_CERT_PEM,
      WECHAT_PAY_PRIVATE_KEY: allSettings.WECHAT_PAY_PRIVATE_KEY,
      WECHAT_PAY_NOTIFY_URL: allSettings.WECHAT_PAY_NOTIFY_URL,
      RATE_LIMIT_WHITELIST_IPS: allSettings.RATE_LIMIT_WHITELIST_IPS,
      RATE_LIMIT_BLACKLIST_IPS: allSettings.RATE_LIMIT_BLACKLIST_IPS,
      RATE_LIMIT_WHITELIST_USERS: allSettings.RATE_LIMIT_WHITELIST_USERS,
      RATE_LIMIT_BLACKLIST_USERS: allSettings.RATE_LIMIT_BLACKLIST_USERS,
      RATE_LIMIT_PEAK_HOURS: allSettings.RATE_LIMIT_PEAK_HOURS,
      RATE_LIMIT_PEAK_FACTOR: allSettings.RATE_LIMIT_PEAK_FACTOR,
      RATE_LIMIT_OFFPEAK_FACTOR: allSettings.RATE_LIMIT_OFFPEAK_FACTOR,
      RATE_LIMIT_REPUTATION_THRESHOLD: allSettings.RATE_LIMIT_REPUTATION_THRESHOLD,
      RATE_LIMIT_REPUTATION_PENALTY: allSettings.RATE_LIMIT_REPUTATION_PENALTY,
      RATE_LIMIT_FACTOR_FREE: allSettings.RATE_LIMIT_FACTOR_FREE,
      RATE_LIMIT_FACTOR_PRO: allSettings.RATE_LIMIT_FACTOR_PRO,
      RATE_LIMIT_FACTOR_PREMIUM: allSettings.RATE_LIMIT_FACTOR_PREMIUM,
    }
  } catch (error) {
    console.error('Failed to fetch settings:', error)
  }
}

const saveSettings = async () => {
  saving.value = true
  try {
    await updateGeneralSettings(settings.value)
    wechatPayTestResult.value = null
    triggerSavedNotice()
  } catch (error) {
    console.error('Failed to save settings:', error)
    alert('保存失败，请重试')
  } finally {
    saving.value = false
  }
}

const runWeChatPayTest = async () => {
  testingWeChatPay.value = true
  try {
    wechatPayTestResult.value = await testWeChatPayConfig(settings.value)
  } catch (error: unknown) {
    console.error('Failed to test wechat pay settings:', error)
    wechatPayTestResult.value = {
      success: false,
      mode: settings.value.WECHAT_PAY_MOCK_MODE === 'true' ? 'mock' : 'live',
      message: extractThrownErrorMessage(error, '微信支付配置测试失败'),
      missing: [],
    }
  } finally {
    testingWeChatPay.value = false
  }
}

const triggerSavedNotice = () => {
  showNotification.value = true
  setTimeout(() => {
    showNotification.value = false
  }, 3000)
}

const downloadConfig = async () => {
  configTransferring.value = true
  try {
    const payload = await exportSystemConfig('deployment')
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type: 'application/json;charset=utf-8'})
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `ai-app-config-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Failed to export config:', error)
    alert('导出配置失败，请重试')
  } finally {
    configTransferring.value = false
  }
}

const openImportPicker = () => {
  importInput.value?.click()
}

const handleImportFile = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''
  if (!file) return

  const confirmed = window.confirm('导入配置会覆盖同名配置项。确认继续吗？')
  if (!confirmed) return

  configTransferring.value = true
  try {
    const raw = await file.text()
    const payload = JSON.parse(raw) as ConfigExportPayload
    if (!payload || !Array.isArray(payload.rows) || !payload.rows.length) {
      throw new Error('invalid payload')
    }

    await importSystemConfig(payload)
    await fetchSettings()
    triggerSavedNotice()
    alert(`导入完成，共导入 ${payload.rows.length} 条配置`)
  } catch (error) {
    console.error('Failed to import config:', error)
    alert('导入配置失败，请确认 JSON 文件来自系统导出')
  } finally {
    configTransferring.value = false
  }
}

const runArchiveDryRun = async () => {
  archiving.value = true
  try {
    const result = await archiveData(archiveDays.value, true)
    archivePreview.value = {
      cutoff: result.cutoff,
      candidates: result.candidates || {},
    }
  } catch (error) {
    console.error('Archive dry run failed:', error)
    alert('归档预览失败，请重试')
  } finally {
    archiving.value = false
  }
}

const runArchiveNow = async () => {
  const confirmed = window.confirm(`确认执行数据归档？将移动 ${archiveDays.value} 天前的数据到归档表。`)
  if (!confirmed) return

  archiving.value = true
  try {
    const result = await archiveData(archiveDays.value, false)
    alert(`归档完成：${JSON.stringify(result.moved || {})}`)
    await runArchiveDryRun()
  } catch (error) {
    console.error('Archive execute failed:', error)
    alert('归档执行失败，请重试')
  } finally {
    archiving.value = false
  }
}

onMounted(() => {
  fetchSettings()
})
</script>
